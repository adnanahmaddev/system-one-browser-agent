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
  confidenceThreshold: 0.75,   // Threshold for Jev System 1 fast-path
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
| **Routine Decision Latency** | 3,000ms – 5,000ms | **70ms – 150ms** |
| **Token Cost per Step** | ~$0.05 – $0.20 | **~$0.0005** |
| **Completion Verification** | Separate multi-second LLM call | **Free in-parallel Noul** |
| **Safety Interception** | Post-hoc parsing | **Pre-execution Noul gate** |

---

## 📁 Project Structure

```
System One/
├── src/
│   ├── browserAgent.ts     # Main dual-process orchestrator loop
│   ├── jevClient.ts        # TypeSafe AI Jev System One decision engine
│   ├── stagehandRunner.ts  # Stagehand browser controller & Gemini fallback
│   ├── types.ts            # TypeScript interfaces & telemetry types
│   └── index.ts            # CLI runner & argument parser
├── examples/
│   ├── quickstart.ts       # Self-contained quickstart demo
│   └── benchmark-comparison.ts # Real-time latency & accuracy benchmark
├── .env                    # API keys configuration
├── package.json
└── tsconfig.json
```
