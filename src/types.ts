export type StepDecisionPath =
  | "SYSTEM_1_JEV"
  | "SYSTEM_2_GEMINI_FALLBACK"
  | "TERMINATE_COMPLETE"
  | "TERMINATE_GUARDRAIL";

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
  latencyMs: number;
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
}

export type FallbackProvider = "gemini" | "claude";

export interface BrowserAgentOptions {
  /** Run browser in visible window (default: true) */
  headless?: boolean;
  /** Jev confidence threshold for fast-path execution (default: 0.55) */
  confidenceThreshold?: number;
  /** Max steps for agent execution (default: 15) */
  maxSteps?: number;
  /** Enable verbose console logs (default: true) */
  verbose?: boolean;
  /** System 2 fallback reasoning model provider (default: "gemini") */
  fallbackProvider?: FallbackProvider;
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
  success: boolean;
  totalSteps: number;
  totalLatencyMs: number;
  system1StepCount: number;
  system2StepCount: number;
  history: StepTelemetry[];
  extractedData?: any;
  terminationReason: string;
}
