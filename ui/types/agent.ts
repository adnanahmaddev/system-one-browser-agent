/**
 * Mirror of the agent's wire types.
 *
 * Source of truth is `src/types.ts` in the repo root. The two are duplicated
 * because the agent and this app are separate packages with different module
 * resolution; keep them in sync when the WebSocket payloads change.
 */

export type StepDecisionPath =
  | "SYSTEM_1_JEV"
  | "SYSTEM_2_GEMINI_FALLBACK"
  | "TERMINATE_COMPLETE"
  | "TERMINATE_GUARDRAIL";

export type RunOutcome =
  | "completed"
  | "max_steps_exhausted"
  | "stagnated"
  | "anti_bot_blocked"
  | "guardrail_blocked"
  | "aborted"
  | "error";

export interface CandidateAction {
  id: string;
  description: string;
  selector?: string;
  method?: string;
  arguments?: unknown[];
  nth?: number;
}

export interface StepTelemetry {
  stepNumber: number;
  decisionPath: StepDecisionPath;
  actionDescription: string;
  jevConfidence: number;
  /** Whole-step wall clock, including the Stagehand observe() LLM call. */
  latencyMs: number;
  /** The Jev System One call alone — the actual reflex latency. */
  jevLatencyMs: number;
  /** The observe() LLM call that precedes every Jev decision. */
  observeLatencyMs: number;
  url: string;
  pageTitle?: string;
  isComplete: boolean;
  completeProbability?: number;
  isDestructive: boolean;
  destructiveProbability?: number;
  pageCategory?: string;
  targetActionIndex?: number;
  candidates?: CandidateAction[];
}

export interface AgentRunResult {
  success: boolean;
  outcome: RunOutcome;
  goalCompleted: boolean;
  totalSteps: number;
  totalLatencyMs: number;
  system1StepCount: number;
  system2StepCount: number;
  /** Share of action steps taken on the fast path, 0–1. */
  system1Ratio: number;
  history: StepTelemetry[];
  extractedData?: unknown;
  terminationReason: string;
}

export interface ConsoleLogLine {
  id: string;
  timestamp: string;
  text: string;
  type: "system" | "fastpath" | "fallback" | "success" | "warn";
}

export type FallbackProvider = "gemini" | "claude";

export type ConnectionStatus = "idle" | "connecting" | "running" | "completed" | "error";

export const FALLBACK_LABELS: Record<FallbackProvider, string> = {
  gemini: "Gemini Flash",
  claude: "Claude Sonnet (Databricks)",
};
