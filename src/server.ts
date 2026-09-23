import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { BrowserAgent } from "./browserAgent.js";
import type { FallbackProvider } from "./types.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const PORT = process.env.AGENT_PORT ? parseInt(process.env.AGENT_PORT, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3001);

// MIME types for static assets
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// Create HTTP server for static files & agent bridge
const server = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = req.url || "/";
  const parsedUrl = new URL(reqUrl, `http://localhost:${PORT}`);
  let pathname = parsedUrl.pathname;

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

  // Normalize path to prevent path traversal
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.join(PUBLIC_DIR, path.normalize(pathname).replace(/^(\.\.[\/\\])+/, ""));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("403 Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA-style routing if file missing
      const indexPath = path.join(PUBLIC_DIR, "index.html");
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
        } else {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("500 Internal Server Error");
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      }
    });
  });
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
  let activeAgent: BrowserAgent | null = null;
  let isAborted = false;

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
        isAborted = true;
        send({ type: "log", text: "⏹ Stopping agent run...", timestamp: Date.now() });
        send({ type: "status", status: "idle" });
        return;
      }

      if (payload.type === "start") {
        if (!payload.goal || typeof payload.goal !== "string") {
          send({ type: "error", error: "Please enter a valid goal instruction." });
          return;
        }

        isAborted = false;
        send({ type: "status", status: "running" });
        send({ type: "clear" });
        send({
          type: "log",
          text: `🚀 Initializing run for goal: "${payload.goal}"`,
          timestamp: Date.now(),
        });

        const fallback: FallbackProvider = payload.fallback === "claude" ? "claude" : "gemini";
        const headless = payload.headless !== false; // Default headless in UI for smooth canvas screencast

        activeAgent = new BrowserAgent({
          headless,
          fallbackProvider: fallback,
          maxSteps: payload.maxSteps ? parseInt(payload.maxSteps, 10) : 15,
          confidenceThreshold: 0.55,
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

        try {
          const result = await activeAgent.run({
            instruction: payload.goal,
            startUrl: payload.startUrl || undefined,
            extractInstruction: payload.extractInstruction || undefined,
          });

          if (!isAborted) {
            send({ type: "result", data: result });
            send({ type: "status", status: "completed" });
          }
        } catch (runErr: any) {
          if (!isAborted) {
            send({
              type: "error",
              error: runErr?.message || "Execution encountered an error.",
            });
            send({ type: "status", status: "error" });
          }
        } finally {
          activeAgent = null;
        }
      }
    } catch (parseErr: any) {
      send({ type: "error", error: `Invalid message payload: ${parseErr.message}` });
    }
  });

  ws.on("close", () => {
    isAborted = true;
    activeAgent = null;
  });
});

server.listen(PORT, () => {
  console.log(`\n⚡ System One Web UI running at: http://localhost:${PORT}`);
  console.log(`   - Static assets: ${PUBLIC_DIR}`);
  console.log(`   - WebSocket:     ws://localhost:${PORT}\n`);
});
