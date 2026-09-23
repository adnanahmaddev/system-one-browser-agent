"use client";

import React from "react";
import { Layers, ChevronRight } from "lucide-react";
import { DecisionBadge } from "@/components/DecisionBadge";
import type { StepTelemetry } from "@/types/agent";

interface StepTimelineProps {
  steps: StepTelemetry[];
  onSelectStep: (step: StepTelemetry) => void;
}

export function StepTimeline({ steps, onSelectStep }: StepTimelineProps) {
  return (
    <section className="flex flex-col min-h-0 flex-1">
      <div className="h-8 shrink-0 px-3 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Steps {steps.length > 0 && <span className="text-[var(--text-tertiary)]">({steps.length})</span>}
        </span>
        {steps.length > 0 && (
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">click to inspect</span>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[var(--text-tertiary)]">
          <Layers className="w-7 h-7 mb-2 opacity-40" />
          <div className="text-xs font-medium text-[var(--text-secondary)]">No steps yet</div>
          <div className="text-[11px] max-w-[15rem] mt-1">
            Run a goal or pick a preset to stream dual-process decisions here.
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {steps.map((step) => (
            <button
              key={step.stepNumber}
              type="button"
              onClick={() => onSelectStep(step)}
              className="group w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex flex-col gap-1"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold font-mono text-[var(--text-tertiary)] shrink-0">
                  {step.stepNumber}
                </span>
                <DecisionBadge path={step.decisionPath} />
                <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="text-xs text-[var(--text-primary)] line-clamp-2">
                {step.actionDescription}
              </div>

              <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)] font-mono">
                <span title="Whole-step wall clock">{step.latencyMs}ms step</span>
                <span title="Jev reflex time alone">{step.jevLatencyMs}ms jev</span>
                <span title="Jev confidence in its element pick">
                  {Math.round((step.jevConfidence || 0) * 100)}% conf
                </span>
                {step.candidates && <span>{step.candidates.length} cands</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
