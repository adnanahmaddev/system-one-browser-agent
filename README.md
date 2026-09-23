# System One Browser Agent Harness (Jev + Stagehand)

A high-speed, dual-process autonomous browser agent built on **Stagehand (by Browserbase)** and **Jev (TypeSafe AI)**, with **Google Gemini Flash** as the System 2 reasoning fallback.

---

## ⚡ Why System One?

Traditional browser agents query an autoregressive LLM (3–8s per step) to read tens of thousands of tokens of DOM data just to decide simple clicks or verify whether a page is done loading.

This harness implements a **Dual-Process ("System 1 + System 2") Architecture**:

```
 ┌────────────────────────────────────────────────────────┐
 │                   User Objective                       │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
                 [ Stagehand Active Page ]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ Candidate Actions ]             [ Page Summary / State ]
            │                                 │
            └────────────────┬────────────────┘
                             │
                             ▼
         ⚡ Jev System One Model (@typesafe-ai/sdk)
         Parallel Evaluation (~70ms - 150ms):
         ├─ Target Action Choice (Which element?)
         ├─ Is Objective Complete? (Noul probability)
         ├─ Is Action Destructive? (Safety guardrail)
         └─ Page Category
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
[ Is Complete? ]     [ Is Destructive? ]   [ Confidence Check ]
  Terminates           Aborts action         ├─ High: Fast Path <100ms
  instantly            for safety            └─ Low: System 2 Gemini Flash
```

* **System 1 (Jev / TypeSafe AI)**: Evaluates multiple typed questions simultaneously in ~70–150ms with ~95% token savings.
* **System 2 (Google Gemini Flash)**: High-speed reasoning model called only when Jev reports low confidence or when complex creative text synthesis/form filling is needed.

---

## 🚀 Quick Start

### 1. Prerequisites
* **Node.js 20+**
* API Keys configured in `.env`:
  ```env
  TYPESAFE_API_KEY="your_typesafe_api_key_here"
  GEMINI_API_KEY="your_gemini_api_key_here"
  ```

### Viewport & screencast quality (optional)

These apply to both the CLI and `npm run ui`, and the effective values are printed
in the server's startup banner:

```env
AGENT_VIEWPORT=2560x1440       # browser viewport in CSS pixels (default 1920x1080)
AGENT_DEVICE_SCALE=2           # device pixel ratio, 1-3 (default 1; 2 = retina)
AGENT_FPS=5                    # target screencast frames/sec (default 2.5)
AGENT_SCREENSHOT_QUALITY=90    # JPEG quality 1-100 (default 80)
```

The viewport is applied with a per-page CDP device-metrics override *after*
Stagehand starts, not via the launch option — Stagehand converts that option into
a Chrome `--window-size` flag, which sizes the window rather than the rendered
page, and converts `deviceScaleFactor` into `--force-device-scale-factor`, which
zooms the page rather than raising capture density. Changing any of these
requires restarting the agent process, since they are applied at browser init.

The viewport is not merely cosmetic — it is what the agent can see. Small
viewports make sites collapse panels and hide controls, so `observe()` returns
genuinely fewer candidates.

Frames are CDP screenshots encoded on the page's own thread, so fps and device
scale are not free: raising both at once measurably slows the agent's real work.
The screencast subtracts each frame's own capture time from the interval and never
runs two captures concurrently, so a slow page degrades the frame rate instead of
queueing up behind itself.

### 2. Run the Benchmark
Measure Jev's parallel decision latency across real-world web scenarios:
```bash
npm run benchmark
```

### 3. Run the Quickstart Agent
Launches a headed Chromium browser window to navigate Hacker News:
```bash
npm run quickstart
```

### 4. Run Custom Tasks via CLI
```bash
# Search and extract Playwright release info
npm start -- --goal "Click on the Releases link" --url "https://github.com/microsoft/playwright"

# Headless mode for CI/CD
npm start -- --goal "Find trending repositories" --url "https://github.com/trending" --headless
```

---

## 🛠️ Programmatic Usage

You can embed the `BrowserAgent` directly into your TypeScript applications:

```typescript
import "dotenv/config";
import { BrowserAgent } from "./src/browserAgent.js";

const agent = new BrowserAgent({
  headless: false,              // Visible browser window
  confidenceThreshold: 0.55,   // Jev fast-path threshold (default 0.55)
  completionThreshold: 0.82,   // Noul threshold for "goal is done" (default 0.82)
  destructiveThreshold: 0.75,  // Noul threshold for the destructive-action gate
  stagnationLimit: 3,          // Identical page fingerprints before giving up
  maxSteps: 10,
  verbose: true,
});

const result = await agent.run({
  instruction: "Navigate to documentation and find the installation command",
  startUrl: "https://docs.typesafe.ai",
  extractInstruction: "Extract the npm install command",
});

console.log("Success:", result.success);
console.log("Extracted:", result.extractedData);
```

---

## 📊 Performance Comparison

| Metric | Traditional LLM Browser Agent | Jev System One Harness |
| :--- | :--- | :--- |
| **Decision step (choose which element to act on)** | One LLM round-trip | **One Jev call — see `Jev reflex` in the telemetry bar** |
| **Completion verification** | Separate LLM call | **Answered in the same parallel Jev request, no extra round-trip** |
| **Safety interception** | Post-hoc parsing of the model's output | **Pre-execution Noul gate** |

> **Read the numbers carefully.** Jev replaces the *decision* LLM call, not every
> LLM call. This harness still pays a Stagehand `observe()` round-trip on **every
> step** to enumerate candidate elements *before* Jev is consulted, so the
> end-to-end time per step is dominated by `observe()`, not by the reflex.
>
> The UI and the CLI summary therefore report `Jev reflex`, `observe() LLM`, and
> `Total/step` as three separate figures. Quote whichever one actually answers
> your question, and measure it on your own pages and network — this table
> deliberately no longer hardcodes latency figures, because the previous ones
> compared a Jev call against a whole agent step.

---

## 📁 Project Structure

```
System One/
├── src/
│   ├── browserAgent.ts     # Main dual-process orchestrator loop
│   ├── jevClient.ts        # TypeSafe AI Jev System One decision engine
│   ├── stagehandRunner.ts  # Stagehand browser controller, viewport & model setup
│   ├── claudeClient.ts     # Claude Sonnet fallback generator for Stagehand
│   ├── displayConfig.ts    # Viewport / screencast environment configuration
│   ├── server.ts           # WebSocket agent bridge for the UI (port 3001)
│   ├── types.ts            # TypeScript interfaces & telemetry types
│   └── index.ts            # CLI runner & argument parser
├── tests/
│   └── agent-guards.test.ts # Guard & config tests (npm test)
├── ui/                     # Next.js 16 operator dashboard (port 3000)
├── examples/
│   ├── quickstart.ts       # Self-contained quickstart demo
│   └── benchmark-comparison.ts # Real-time latency & accuracy benchmark
├── .env                    # API keys configuration
├── package.json
└── tsconfig.json
```

---

## 🖥️ Web UI

```bash
npm run ui     # Next.js dashboard on :3000 + agent bridge on :3001
npm run server # bridge only
```

The bridge binds to `127.0.0.1` and checks the `Origin` header on every WebSocket
handshake — handshakes are not covered by CORS, so without that check any open web
page could drive the agent's browser. Extend the allowlist with
`AGENT_ALLOWED_ORIGINS`.

---

## ✅ Tests

```bash
npm test       # 7 tests (node:test via tsx)
npm run build  # typecheck
```
