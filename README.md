# System One Browser Agent

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-20+-68a063?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20NodeNext-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Stagehand](https://img.shields.io/badge/Stagehand-v4.1.0-ff5c00?style=flat-square)](https://github.com/browserbase/stagehand)
[![Next.js](https://img.shields.io/badge/Next.js-16%20App%20Router-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tests](https://img.shields.io/badge/Tests-7%20passing-brightgreen?style=flat-square)](https://github.com/adnanahmaddev/system-one-browser-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

<p align="center">
  <strong>A high-speed, dual-process autonomous browser agent harness combining sub-150ms Jev reflex decisions with Stagehand stealth automation and Gemini/Claude System 2 reasoning.</strong>
</p>

</div>

---

## 🎥 Video Walkthrough & Live Demo

<div align="center">
  <a href="https://www.youtube.com/watch?v=7ICOUt2kaoI" target="_blank" rel="noopener noreferrer">
    <img src="https://img.youtube.com/vi/7ICOUt2kaoI/maxresdefault.jpg" alt="System One Browser Agent Demo Video" width="850" style="max-width: 100%; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.25);" />
  </a>
  <p><em>▶️ <strong><a href="https://www.youtube.com/watch?v=7ICOUt2kaoI">Click above to watch the System One Live Demo on YouTube</a></strong></em></p>
</div>

---

## ⚡ Why Dual-Process ("System 1 + System 2")?

Traditional browser agents query an autoregressive LLM for every single DOM interaction—burning **3–8 seconds** and thousands of tokens per step just to decide simple clicks or verify whether a page is done loading.

Inspired by Daniel Kahneman’s *Thinking, Fast and Slow*, **System One** splits browser navigation into two complementary tiers:

```
                            ┌──────────────────────────┐
                            │      User Objective      │
                            └─────────────┬────────────┘
                                          │
                                          ▼
                              [ Stagehand Page State ]
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                 ▼
                [ Candidate Actions ]             [ Clean Page Summary ]
                         │                                 │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                      ⚡ Jev System One Model (@typesafe-ai/sdk)
                      Parallel Questions (Single Request ~70ms–150ms):
                      ├─ target (choice: which candidate action?)
                      ├─ is_complete (noul: is objective finished?)
                      ├─ is_destructive (noul: is this action dangerous?)
                      └─ page_category (choice: search/form/content/anti-bot)
                                          │
                   ┌──────────────────────┼──────────────────────┐
                   ▼                      ▼                      ▼
          [ is_complete > 0.82 ]  [ is_destructive > 0.75 ]   [ Confidence Check ]
             Finish task             Halt execution for          ├─ >= 0.55: Fast Path (<100ms)
             immediately             user safety guardrail       └─ < 0.55: System 2 Gemini / Claude
```

* **System 1 (Jev / TypeSafe AI)**: High-speed, parallel, typed decision model (`@typesafe-ai/sdk`) that resolves element choice, goal completion, and destructive action interception simultaneously in **~70ms–150ms**.
* **System 2 (Google Gemini Flash / Claude Sonnet)**: Deep reasoning fallback called only when Jev confidence is low (< 0.55) or when complex creative synthesis / unindexed form interaction is required.

---

## 🎯 Core Decision Matrix & Safety Guardrails

| Condition | Action Taken | Rationale |
|---|---|---|
| `is_complete > 0.82` | **Terminate with Success** | Zero-latency exit when the goal is achieved (including Step 1 informational queries). |
| `is_destructive > 0.75` | **Halt with Safety Warning** | Pre-execution safety gate prevents unwanted purchases, form submissions, or deletions. |
| `confidence >= 0.55` | **Fast-Path `stagehand.act(candidate)`** | Executes the selected candidate directly in milliseconds without re-prompting an LLM. |
| `confidence < 0.55` | **System 2 `stagehand.act(naturalLanguage)`** | Fallback to Gemini 2.5 Flash or Claude 3.5 Sonnet for deep reasoning. |
| Stagnant Page Fingerprint (3 steps) | **Early Exit / Final Extraction** | Breaks infinite loops on unresponsive SPAs using URL + visible-text hash. |
| Consecutive `anti_bot` Categories | **Terminate `anti_bot_blocked`** | Aborts cleanly rather than endlessly clicking against an unsolvable captcha. |
| HTTP Status `>= 400` on Navigation | **Fail-Fast Before Step 1** | Prevents spending step budgets on 404/500 error pages. |

---

## ✨ Key Features

* ⚡ **Sub-150ms Reflex Decisions**: Replaces multi-second LLM reasoning for candidate element selection with typed Jev evaluations.
* 🛡️ **Pre-Execution Destructive Action Gate**: Intercepts dangerous actions (purchases, payments, account deletions) before the click happens.
* 🎯 **Single-Request Completion Detection**: Determines whether the goal is fulfilled in the exact same round-trip as the element choice.
* 🖥️ **Full-Featured Operator Web UI**: Next.js 16 + React 19 dashboard with live CDP viewport screencast, step timeline, and telemetry.
* 🧠 **Multi-Model System 2 Fallback**: Seamless switch between Google Gemini 2.5 Flash (default) and Claude 3.5 Sonnet (`--fallback claude`).
* 🔄 **Self-Healing Automation**: Powered by Stagehand v4 with CDP stealth and resilient selector healing over Playwright Chromium.
* ⏱️ **Transparent Telemetry**: Dedicated tracking of `Jev reflex`, `observe() LLM`, and `Total/step` latency metrics.

---

## 🖥️ Operator Web UI

System One includes a purpose-built Next.js 16 operator dashboard (`ui/`) for driving and observing the browser agent in real time.

```bash
# Launch the Next.js UI (port 3000) and Agent Bridge (port 3001) concurrently
npm run ui
```

Then navigate to **<http://localhost:3000>**.

### UI Highlights
* **Live Viewport Screencasting**: Streams real-time frames over WebSocket directly from Chromium CDP with custom viewport and density settings.
* **Interactive Step Timeline**: Step-by-step trace showing candidate action rankings, confidence meters, and action statuses.
* **Step Inspector Drawer**: Detailed breakdown of Jev answers, probability distributions, candidate choices, and raw telemetry data.
* **Live Telemetry Bar**: Instant visibility into reflex latency, observe time, total step duration, and safety guard status.
* **Keyboard First**: Press `Cmd/Ctrl + Enter` to launch a run; press `Esc` to dismiss inspectors.
* **Theme Support**: Seamless Light, Dark, and System modes styled with Tailwind CSS tokens.

---

## 🚀 Quick Start

### 1. Prerequisites
* **Node.js 20+**
* API keys configured in `.env` (copy from `.env.example`):
  ```bash
  cp .env.example .env
  ```
  Configure your keys in `.env`:
  ```env
  TYPESAFE_API_KEY="your_typesafe_api_key_here"
  GEMINI_API_KEY="your_gemini_api_key_here"
  ```

### 2. Run the Benchmark
Measure Jev's parallel decision latency across real-world web states:
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
# Search and extract Playwright release notes on GitHub
npm start -- --goal "Click on the Releases link" --url "https://github.com/microsoft/playwright"

# Run headless with structured extraction
npm start -- --goal "Find trending repos" --url "https://github.com/trending" --extract "Top 3 repositories" --headless

# Use Claude 3.5 Sonnet as the System 2 fallback
npm start -- --goal "Find top story" --url "https://news.ycombinator.com" --fallback claude
```

---

## ⌨️ CLI Options Reference

| Option | Shorthand | Default | Description |
|---|---|---|---|
| `--goal` | `-g` | Playwright Demo | Natural language task instruction for the agent. |
| `--url` | `-u` | GitHub Playwright | Initial URL to navigate to. |
| `--extract` | `-e` | `undefined` | Extraction instruction to parse structured data from the final page. |
| `--fallback` | `-f` | `gemini` | System 2 fallback reasoning model (`gemini` or `claude`). |
| `--steps` | `-s` | `10` | Maximum number of browser interaction steps before stopping. |
| `--headless` | — | `false` | Run browser in headless mode (ideal for CI/CD and servers). |

---

## ⚙️ Configuration & Environment Variables

All settings can be configured via your `.env` file or shell environment:

| Variable | Default | Description |
|---|---|---|
| `TYPESAFE_API_KEY` | *(Required)* | TypeSafe AI API key for Jev System One decision engine. |
| `GEMINI_API_KEY` | *(Required for default)* | Google Gemini API key for default System 2 reasoning fallback. |
| `ANTHROPIC_API_KEY` | *(Optional)* | Anthropic API key (or auth token) when running with `--fallback claude`. |
| `AGENT_VIEWPORT` | `1920x1080` | Browser viewport dimensions in CSS pixels (e.g. `2560x1440`). |
| `AGENT_DEVICE_SCALE` | `1` | Device pixel ratio (1–3; set to `2` for retina capture density). |
| `AGENT_FPS` | `2.5` | Target screencast frame rate (0.5–15 FPS). |
| `AGENT_SCREENSHOT_QUALITY` | `80` | Screencast JPEG quality (1–100). |
| `AGENT_ALLOWED_ORIGINS` | `localhost:3000,...` | Comma-separated list of origins permitted to connect to the agent WebSocket bridge. |
| `AGENT_PORT` or `PORT` | `3001` | Port for the WebSocket server and `/api/health` bridge. |
| `AGENT_HOST` | `127.0.0.1` | Loopback bind address for security. |

> [!NOTE]
> Viewport and screencast settings are applied during browser initialization via CDP device-metrics overrides. Restart the server or CLI process for environment variable changes to take effect.

---

## 🛠️ Programmatic Usage

You can easily embed `BrowserAgent` into your own Node.js or TypeScript services:

```typescript
import "dotenv/config";
import { BrowserAgent } from "./src/browserAgent.js";

const agent = new BrowserAgent({
  headless: false,              // Headed or headless Chromium
  confidenceThreshold: 0.55,   // Jev fast-path threshold
  completionThreshold: 0.82,   // Noul threshold for completion detection
  destructiveThreshold: 0.75,  // Noul threshold for safety guardrail
  stagnationLimit: 3,          // Max identical page steps before loop bailout
  maxSteps: 10,
  verbose: true,
  fallbackProvider: "gemini",  // "gemini" | "claude"
});

const result = await agent.run({
  instruction: "Navigate to documentation and find the installation command",
  startUrl: "https://docs.typesafe.ai",
  extractInstruction: "Extract the exact npm install command snippet",
});

console.log("Success:", result.success);
console.log("Extracted Data:", result.extractedData);
console.log("History Trace:", result.history);
```

---

## ⏱️ Telemetry & The "3-Metric Truth"

Many browser agent benchmarks report misleading latency numbers by comparing a sub-second decision against an entire end-to-end multi-step workflow.

System One maintains honest, granular telemetry by separating and measuring the three phases of every browser step:

| Telemetry Metric | Typical Duration | What It Measures |
|---|---|---|
| **`Jev reflex`** | **~70ms – 150ms** | Single parallel TypeSafe AI request deciding candidate action, completion probability, and safety status. |
| **`observe() LLM`** | **~1.5s – 3.5s** | Stagehand DOM candidate enumeration round-trip paid to discover actionable elements. |
| **`Total/step`** | **~2.0s – 4.5s** | Total end-to-end wall-clock time including page DOM settlement, CDP screencast, candidate extraction, and action dispatch. |

Jev replaces the **decision LLM round-trip** with a typed reflex, guaranteeing that once candidate elements are observed, the action is chosen and verified almost instantaneously.

---

## 📁 Repository Structure

```
system-one-browser-agent/
├── src/
│   ├── browserAgent.ts       # Master dual-process loop, telemetry, & safety gates
│   ├── jevClient.ts          # TypeSafe AI Jev System One decision engine wrapper
│   ├── stagehandRunner.ts    # Stagehand v4 lifecycle, viewport & CDP execution
│   ├── claudeClient.ts       # Claude Sonnet fallback generator (Databricks Gateway)
│   ├── displayConfig.ts      # Viewport, scale, FPS, and quality env parsers
│   ├── server.ts             # WebSocket agent bridge & security origin check
│   ├── types.ts              # Strict TypeScript interfaces & telemetry types
│   └── index.ts              # CLI runner and argument parser
├── ui/                       # Next.js 16 operator dashboard (runs on port 3000)
│   ├── app/                  # App Router shell, layout, and globals.css
│   ├── components/           # LiveViewport, StepTimeline, Inspector, ConsoleDrawer
│   ├── lib/                  # Theme store and client WebSocket helpers
│   └── types/                # Mirrored UI telemetry types
├── examples/
│   ├── quickstart.ts         # Self-contained Hacker News demo
│   └── benchmark-comparison.ts # Real-time latency benchmark
├── tests/
│   └── agent-guards.test.ts  # Node:test suite for URL guards & display configs
├── assets/
│   └── demo-preview.svg      # Visual demo banner & preview asset
├── .env.example              # Environment variables template
├── package.json              # ESM configuration & scripts
└── tsconfig.json             # Strict NodeNext TypeScript configuration
```

---

## 🧪 Testing & Verification

System One includes an automated unit test suite executed via Node's native test runner (`node:test` via `tsx`):

```bash
# Run the test suite (7 automated tests)
npm test

# Typecheck the entire codebase
npm run build
```

---

## 📜 License & Acknowledgments

This project is licensed under the **MIT License**.

Built with:
* [TypeSafe AI](https://typesafe.ai) — For the high-speed Jev System One decision model (`@typesafe-ai/sdk`).
* [Browserbase Stagehand](https://github.com/browserbase/stagehand) — For self-healing AI browser automation and stealth Playwright abstraction.
* [Google Gemini](https://ai.google.dev/) & [Anthropic Claude](https://anthropic.com) — For System 2 deep reasoning fallbacks.
