export type StepDecisionPath =
  | "SYSTEM_1_JEV"
  | "SYSTEM_2_GEMINI_FALLBACK"
  | "TERMINATE_COMPLETE"
  | "TERMINATE_GUARDRAIL";

export interface CandidateAction {
  id: string;
  description: string;
  selector?: string;
  method?: string;
  arguments?: any[];
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

export interface ConsoleLogLine {
  id: string;
  timestamp: string;
  text: string;
  type: "system" | "fastpath" | "fallback" | "success" | "warn";
}
