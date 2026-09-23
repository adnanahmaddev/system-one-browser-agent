"use client";

import React from "react";
import { Zap, Cpu, CheckCircle2, AlertTriangle, ChevronRight, Layers } from "lucide-react";
import type { StepTelemetry } from "@/types/agent";

interface StepTimelineProps {
  steps: StepTelemetry[];
  onSelectStep: (step: StepTelemetry) => void;
}

export function StepTimeline({ steps, onSelectStep }: StepTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--text-tertiary)] border border-dashed border-[var(--border-subtle)] rounded-lg min-h-[220px]">
        <Layers className="w-8 h-8 mb-2 opacity-40" />
        <div className="text-xs font-medium text-[var(--text-secondary)]">No steps executed yet</div>
        <div className="text-[11px] max-w-xs mt-1">
          Launch an agent goal or click a preset to see dual-process decisions stream live.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
      {steps.map((step) => {
        const isS1 = step.decisionPath === "SYSTEM_1_JEV";
        const isS2 = step.decisionPath === "SYSTEM_2_GEMINI_FALLBACK";
        const isComplete = step.decisionPath === "TERMINATE_COMPLETE";
        const isGuardrail = step.decisionPath === "TERMINATE_GUARDRAIL";
        const confPercent = Math.round((step.jevConfidence || 0) * 100);

        return (
          <div
            key={step.stepNumber}
            data-step-card={step.stepNumber}
            onClick={() => onSelectStep(step)}
            className="group bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] rounded p-3 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold font-mono text-[var(--text-secondary)]">
                  Step {step.stepNumber}
                </span>

                {isS1 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--tag-green-bg)] text-[var(--tag-green-text)]">
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    <span>System 1 (Jev Reflex)</span>
                  </span>
                )}
                {isS2 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--tag-blue-bg)] text-[var(--tag-blue-text)]">
                    <Cpu className="w-2.5 h-2.5" />
                    <span>System 2 Fallback</span>
                  </span>
                )}
                {isComplete && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--tag-purple-bg)] text-[var(--tag-purple-text)]">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>Goal Complete</span>
                  </span>
                )}
                {isGuardrail && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--tag-red-bg)] text-[var(--tag-red-text)]">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>Guardrail</span>
                  </span>
                )}
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="text-xs font-medium text-[var(--text-primary)] line-clamp-2">
              {step.actionDescription}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] font-mono">
              <span>⏱ {step.latencyMs}ms</span>
              <span>🎯 Conf: {confPercent}%</span>
              {step.candidates && (
                <span>👁 {step.candidates.length} candidates</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
