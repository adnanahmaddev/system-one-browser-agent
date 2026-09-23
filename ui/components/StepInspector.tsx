"use client";

import React from "react";
import { X, Zap, Cpu, CheckCircle2, AlertTriangle, ExternalLink, MousePointerClick } from "lucide-react";
import type { StepTelemetry } from "@/types/agent";

interface StepInspectorProps {
  step: StepTelemetry | null;
  onClose: () => void;
}

export function StepInspector({ step, onClose }: StepInspectorProps) {
  if (!step) return null;

  const isS1 = step.decisionPath === "SYSTEM_1_JEV";
  const isS2 = step.decisionPath === "SYSTEM_2_GEMINI_FALLBACK";
  const isComplete = step.decisionPath === "TERMINATE_COMPLETE";
  const isGuardrail = step.decisionPath === "TERMINATE_GUARDRAIL";

  const confPercent = Math.round((step.jevConfidence || 0) * 100);
  const completePercent = Math.round((step.completeProbability || 0) * 100);
  const destructivePercent = Math.round((step.destructiveProbability || 0) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inspector Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Step {step.stepNumber} Decision Breakdown
            </span>
            {isS1 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--tag-green-bg)] text-[var(--tag-green-text)]">
                <Zap className="w-3 h-3 fill-current" />
                <span>System 1 (Jev Reflex)</span>
              </span>
            )}
            {isS2 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--tag-blue-bg)] text-[var(--tag-blue-text)]">
                <Cpu className="w-3 h-3" />
                <span>System 2 Fallback</span>
              </span>
            )}
            {isComplete && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--tag-purple-bg)] text-[var(--tag-purple-text)]">
                <CheckCircle2 className="w-3 h-3" />
                <span>Completion Detected</span>
              </span>
            )}
            {isGuardrail && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--tag-red-bg)] text-[var(--tag-red-text)]">
                <AlertTriangle className="w-3 h-3" />
                <span>Guardrail Blocked</span>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inspector Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Action Summary */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-3">
            <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
              Executed Action
            </div>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {step.actionDescription}
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Latency */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-3 flex flex-col justify-between">
              <span className="text-[11px] text-[var(--text-secondary)]">Decision Latency</span>
              <span className="text-lg font-mono font-bold text-[var(--text-primary)] mt-1">
                {step.latencyMs}ms
              </span>
            </div>

            {/* Jev Confidence */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-3 flex flex-col justify-between">
              <span className="text-[11px] text-[var(--text-secondary)]">Jev Confidence</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-mono font-bold text-[var(--tag-green-text)]">
                  {confPercent}%
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {confPercent >= 55 ? "Fast-path qualified" : "Below threshold"}
                </span>
              </div>
            </div>

            {/* Completion Probability */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-3 flex flex-col justify-between">
              <span className="text-[11px] text-[var(--text-secondary)]">Completion Probability</span>
              <span className="text-lg font-mono font-bold text-[var(--tag-purple-text)] mt-1">
                {completePercent}%
              </span>
            </div>
          </div>

          {/* URL & Page Title */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-3 flex flex-col gap-1">
            <span className="text-[11px] text-[var(--text-secondary)]">Page Context</span>
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {step.pageTitle || "Untitled Page"}
            </div>
            <div className="flex items-center gap-1 text-[var(--text-tertiary)] font-mono truncate">
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">{step.url}</span>
            </div>
          </div>

          {/* Observed Candidates Breakdown */}
          {step.candidates && step.candidates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Observed Candidate Elements ({step.candidates.length})
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  Highlighted item indicates Jev reflex pick
                </span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {step.candidates.map((cand, idx) => {
                  const isSelected = step.targetActionIndex === idx;
                  return (
                    <div
                      key={cand.id || idx}
                      className={`p-2.5 rounded border transition-all text-xs flex items-start gap-2.5 ${
                        isSelected
                          ? "bg-[var(--tag-green-bg)] border-[var(--tag-green-text)] text-[var(--text-primary)] shadow-xs"
                          : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <span className="px-1.5 py-0.5 rounded bg-[var(--tag-green-text)] text-white text-[10px] font-bold font-mono">
                            PICK #{idx}
                          </span>
                        ) : (
                          <span className="font-mono text-[var(--text-tertiary)] text-[11px]">
                            #{idx}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--text-primary)]">
                          {cand.description}
                        </div>
                        {cand.selector && (
                          <div className="text-[11px] font-mono text-[var(--text-tertiary)] truncate mt-0.5">
                            {cand.selector}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <MousePointerClick className="w-4 h-4 text-[var(--tag-green-text)] shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium text-xs hover:bg-[var(--bg-active)] transition-all cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
