export type StepDecisionPath =
  | "SYSTEM_1_JEV"
  | "SYSTEM_2_GEMINI_FALLBACK"
  | "TERMINATE_COMPLETE"
  | "TERMINATE_GUARDRAIL";

/**
 * Why a run stopped. Only "completed" is an affirmative goal achievement; every
 * other value means the agent gave up, was stopped, or was blocked.
 */
export type RunOutcome =
  | "completed"
  | "max_steps_exhausted"
  | "stagnated"
  | "anti_bot_blocked"
  | "guardrail_blocked"
  | "aborted"
  | "error";

export const OUTCOME_DESCRIPTIONS: Record<RunOutcome, string> = {
  completed: "Jev verified the objective was achieved on the current page",
  max_steps_exhausted: "Step budget exhausted before the objective was verified as complete",
  stagnated: "Page state stopped changing across consecutive steps; no further progress possible",
  anti_bot_blocked: "Blocked by a captcha or bot-detection challenge",
  guardrail_blocked: "Safety guardrail blocked a potentially destructive action",
  aborted: "Run was stopped by the operator",
  error: "Run failed with an unrecoverable error",
};

export interface AgentGoal {
  /** The natural language objective (e.g. "Find the latest release version of Playwright on GitHub") */
  instruction: string;
  /** Optional starting URL (e.g. "https://github.com/microsoft/playwright") */
  startUrl?: string;
  /** Maximum number of browser actions allowed (default: 15) */
  maxSteps?: number;
  /** Optional domain restrictions */
  allowedDomains?: string[];
  /** Optional extraction instruction when finished */
  extractInstruction?: string;
}

export interface StepTelemetry {
  stepNumber: number;
  decisionPath: StepDecisionPath;
  actionDescription: string;
  jevConfidence: number;
  /**
   * Wall-clock time for the whole step, including the Stagehand `observe()` LLM
   * round-trip and the action itself. This is NOT the Jev reflex time.
   */
  latencyMs: number;
  /** Time spent inside the Jev System One call alone (the actual reflex latency). */
  jevLatencyMs: number;
  /** Time spent in the Stagehand `observe()` LLM call that precedes every Jev decision. */
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

export interface JevStepEvaluation {
  targetActionIndex: number;
  targetActionLabel: string;
  isComplete: boolean;
  completeProbability: number;
  isDestructive: boolean;
  destructiveProbability: number;
  confidence: number;
  pageCategory: string;
  rawResponse?: any;
}

export interface CandidateAction {
  id: string;
  description: string;
  selector?: string;
  method?: string;
  arguments?: any[];
  /**
   * Index to disambiguate a selector that matches several elements. Set for the
   * synthetic autocomplete-commit candidate, where the first visible match is
   * not necessarily the first match.
   */
  nth?: number;
}

export type FallbackProvider = "gemini" | "claude";

export interface BrowserAgentOptions {
  /** Run browser in visible window (default: true) */
  headless?: boolean;
  /** Jev confidence threshold for fast-path execution (default: 0.55) */
  confidenceThreshold?: number;
  /** Noul probability above which the goal counts as achieved (default: 0.82) */
  completionThreshold?: number;
  /** Noul probability above which an action is blocked as destructive (default: 0.75) */
  destructiveThreshold?: number;
  /**
   * Consecutive steps with an identical page fingerprint (URL + visible text)
   * before the run is declared stagnant (default: 3).
   */
  stagnationLimit?: number;
  /** Max steps for agent execution (default: 15) */
  maxSteps?: number;
  /** Enable verbose console logs (default: true) */
  verbose?: boolean;
  /** System 2 fallback reasoning model provider (default: "gemini") */
  fallbackProvider?: FallbackProvider;
  /** Browser viewport in CSS pixels (default: 1920x1080) */
  viewport?: { width: number; height: number };
  /** Device pixel ratio; 2 is retina-sharp at ~4x the frame bytes (default: 1) */
  deviceScaleFactor?: number;
  /** JPEG quality of screencast frames, 1-100 (default: 80) */
  screenshotQuality?: number;
  /**
   * Target screencast interval in ms (default: 400, i.e. 2.5fps).
   *
   * This is a *target*, not a guarantee: each frame is a CDP screenshot that runs
   * on the page's own thread, so the achievable rate is bounded by encode time.
   * The next frame is always scheduled after the previous one completes, never
   * concurrently with it.
   */
  screencastIntervalMs?: number;
  /**
   * Cooperative cancellation. When aborted the loop exits at its next checkpoint
   * and the browser is closed. An LLM call already in flight is allowed to settle.
   */
  signal?: AbortSignal;
  /** Streaming callback for each step telemetry update */
  onStep?: (telemetry: StepTelemetry) => void;
  /** Streaming callback for log messages */
  onLog?: (msg: string) => void;
  /** Streaming callback for page URL / title changes */
  onPageChange?: (title: string, url: string) => void;
  /** Streaming callback for live browser screenshots (base64 JPEG) */
  onScreenshot?: (base64: string) => void;
}

export interface AgentRunResult {
  /**
   * True only when the run reached an affirmative end: Jev verified completion,
   * or extraction was requested and returned data. Exhausting the step budget,
   * stagnating, being aborted, or hitting a guardrail all report false.
   */
  success: boolean;
  /** Machine-readable reason the run stopped. */
  outcome: RunOutcome;
  /** True only when Jev verified the objective was achieved. */
  goalCompleted: boolean;
  /** Number of steps recorded in `history`. */
  totalSteps: number;
  totalLatencyMs: number;
  system1StepCount: number;
  system2StepCount: number;
  /** Share of *action* steps taken on the System 1 fast path, 0–1. Excludes terminal pseudo-steps. */
  system1Ratio: number;
  history: StepTelemetry[];
  extractedData?: any;
  terminationReason: string;
}
