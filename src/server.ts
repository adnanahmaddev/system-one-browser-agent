import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { BrowserAgent } from "./browserAgent.js";
import { describeDisplayConfig, readDisplayConfig } from "./displayConfig.js";
import type { FallbackProvider } from "./types.js";

dotenv.config();

const PORT = process.env.AGENT_PORT ? parseInt(process.env.AGENT_PORT, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3001);

/**
 * Bind to loopback by default. This server launches a real browser and executes
 * arbitrary instructions in it, so it must not be reachable from the network.
 */
const HOST = process.env.AGENT_HOST || "127.0.0.1";

/**
 * Origins permitted to open a WebSocket or read the API.
 *
 * This is a security boundary, not a convenience: WebSocket handshakes are NOT
 * subject to the same-origin policy or CORS, so without an Origin check any web
 * page you happen to have open could connect to this port and drive the agent's
 * browser (cross-site WebSocket hijacking). Set AGENT_ALLOWED_ORIGINS to a
 * comma-separated list to extend it.
 */
const ALLOWED_ORIGINS = new Set(
  (process.env.AGENT_ALLOWED_ORIGINS ||
    `http://localhost:3000,http://127.0.0.1:3000,http://localhost:${PORT},http://127.0.0.1:${PORT}`)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
);

/**
 * A missing Origin header means a non-browser client (curl, a test script, the
 * `ws` library). Those are allowed because the port is loopback-only; it is
 * browser-originated cross-site requests that need blocking.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin);
}

/** Viewport / screencast settings; see displayConfig.ts for the env vars. */
const DISPLAY = readDisplayConfig();

/**
 * HTTP surface is the health endpoint only. This process is the agent bridge; the
 * operator UI is the Next.js app in `ui/`, served by `next dev`/`next start` on
 * its own port and talking to this one over the WebSocket.
 */
const server = http.createServer((req, res) => {
  const origin = req.headers.origin;

  // Echo only allowlisted origins. A wildcard here would let any site read the
  // API responses from this port.
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (origin && !isOriginAllowed(origin)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("403 Forbidden: origin not allowed");
    return;
  }

  const pathname = new URL(req.url || "/", `http://localhost:${PORT}`).pathname;

  if (pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        hasJevKey: !!process.env.TYPESAFE_API_KEY,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Not found",
      hint: "This port is the agent WebSocket bridge. The UI runs separately from ui/ (npm --prefix ui run dev).",
    })
  );
});

// Create WebSocket server attached to HTTP server.
// verifyClient rejects cross-site handshakes; see ALLOWED_ORIGINS above for why
// this cannot be left to CORS.
const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }, done) => {
    if (isOriginAllowed(origin)) return done(true);
    console.warn(`Rejected WebSocket handshake from disallowed origin: ${origin}`);
    done(false, 403, "Forbidden origin");
  },
});

wss.on("connection", (ws: WebSocket) => {
  let activeAgent: BrowserAgent | null = null;

  const send = (msg: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  send({
    type: "connected",
    message: "Connected to System One Agent Bridge",
    models: {
      system1: "TypeSafe AI Jev (System One)",
      system2Gemini: "Google Gemini Flash",
      system2Claude: "Anthropic Claude Sonnet (Databricks AI Gateway)",
    },
  });

  ws.on("message", async (rawMessage: string) => {
    try {
      const payload = JSON.parse(rawMessage.toString());

      if (payload.type === "stop") {
        if (!activeAgent) {
          send({ type: "status", status: "idle" });
          return;
        }
        // Actually cancel the run. The agent exits at its next checkpoint and
        // closes the browser; status stays "running" until that completes so the
        // UI cannot claim idle while Chromium is still driving.
        send({
          type: "log",
          text: "⏹ Stop requested — finishing the in-flight action, then closing the browser...",
          timestamp: Date.now(),
        });
        activeAgent.stop();
        return;
      }

      if (payload.type === "start") {
        if (!payload.goal || typeof payload.goal !== "string") {
          send({ type: "error", error: "Please enter a valid goal instruction." });
          return;
        }

        // One run per connection. Without this, a second "start" would launch a
        // second browser and orphan the first agent reference.
        if (activeAgent) {
          send({ type: "error", error: "A run is already in progress. Stop it before starting another." });
          return;
        }

        send({ type: "status", status: "running" });
        send({ type: "clear" });
        send({
          type: "log",
          text: `🚀 Initializing run for goal: "${payload.goal}"`,
          timestamp: Date.now(),
        });

        const fallback: FallbackProvider = payload.fallback === "claude" ? "claude" : "gemini";
        const headless = payload.headless !== false; // Default headless in UI for smooth canvas screencast

        const agent = new BrowserAgent({
          headless,
          fallbackProvider: fallback,
          maxSteps: payload.maxSteps ? parseInt(payload.maxSteps, 10) : 15,
          confidenceThreshold:
            typeof payload.confidenceThreshold === "number" ? payload.confidenceThreshold : 0.55,
          ...DISPLAY,
          verbose: true,
          onStep: (telemetry) => {
            send({ type: "step", data: telemetry });
          },
          onLog: (text) => {
            send({ type: "log", text, timestamp: Date.now() });
          },
          onPageChange: (title, url) => {
            send({ type: "page", title, url });
          },
          onScreenshot: (base64) => {
            send({ type: "screenshot", base64 });
          },
        });
        activeAgent = agent;

        try {
          const result = await agent.run({
            instruction: payload.goal,
            startUrl: payload.startUrl || undefined,
            extractInstruction: payload.extractInstruction || undefined,
          });

          // Always report the result, including for a stopped run — the operator
          // should still see the steps and telemetry the run produced.
          send({ type: "result", data: result });
          send({ type: "status", status: result.success ? "completed" : "error" });
        } catch (runErr: any) {
          send({
            type: "error",
            error: runErr?.message || "Execution encountered an error.",
          });
          send({ type: "status", status: "error" });
        } finally {
          activeAgent = null;
        }
      }
    } catch (parseErr: any) {
      send({ type: "error", error: `Invalid message payload: ${parseErr.message}` });
    }
  });

  // A closed socket must tear the browser down, otherwise closing the UI tab
  // orphans a Chromium process for the remainder of the run.
  ws.on("close", () => {
    if (activeAgent) {
      console.log("Client disconnected mid-run — aborting agent and closing browser.");
      activeAgent.stop();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n⚡ System One agent service running at: http://${HOST}:${PORT}`);
  console.log(`   - WebSocket:       ws://${HOST}:${PORT}`);
  console.log(`   - Health:          http://${HOST}:${PORT}/api/health`);
  console.log(`   - Screencast:      ${describeDisplayConfig(DISPLAY)}`);
  console.log(`   - UI:              run \`npm --prefix ui run dev\` (http://localhost:3000)`);
  console.log(`   - Allowed origins: ${[...ALLOWED_ORIGINS].join(", ")}\n`);
});
