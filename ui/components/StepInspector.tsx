"use client";

import React from "react";
import { X, ExternalLink, MousePointerClick } from "lucide-react";
import { DecisionBadge } from "@/components/DecisionBadge";
import type { StepTelemetry } from "@/types/agent";

interface StepInspectorProps {
  step: StepTelemetry | null;
  onClose: () => void;
}

function Stat({ label, value, accent, hint }: { label: string; value: string; accent?: string; hint?: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-3 flex flex-col gap-1" title={hint}>
      <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
      <span
        className="text-base font-mono font-bold"
        style={{ color: accent ?? "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function StepInspector({ step, onClose }: StepInspectorProps) {
  if (!step) return null;

  const pct = (n?: number) => `${Math.round((n || 0) * 100)}%`;

  return (
    // Backdrop closes on click; the panel stops propagation so clicks inside stay.
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Step ${step.stepNumber} decision breakdown`}
        className="bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm font-semibold text-[var(--text-primary)] shrink-0">
              Step {step.stepNumber}
            </span>
            <DecisionBadge path={step.decisionPath} size="md" />
          </div>

          <button
            onClick={onClose}
            aria-label="Close inspector"
            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-3">
            <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
              Executed action
            </div>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {step.actionDescription}
            </div>
          </div>

          {/* The three latencies are split because the step total is dominated by
              observe(), not by the Jev reflex it is often mistaken for. */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Jev reflex"
              value={`${step.jevLatencyMs}ms`}
              accent="var(--tag-purple-text)"
              hint="Time inside the Jev System One call alone"
            />
            <Stat
              label="observe() LLM"
              value={`${step.observeLatencyMs}ms`}
              accent="var(--tag-amber-text)"
              hint="Stagehand observe() round-trip, paid before Jev is consulted"
            />
            <Stat label="Step total" value={`${step.latencyMs}ms`} hint="Whole-step wall clock" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Jev confidence"
              value={pct(step.jevConfidence)}
              accent="var(--tag-green-text)"
              hint="Confidence in the element pick; drives the fast-path decision"
            />
            <Stat
              label="Goal complete"
              value={pct(step.completeProbability)}
              accent="var(--tag-purple-text)"
              hint="Jev's probability that the objective is already satisfied on this page"
            />
            <Stat
              label="Destructive"
              value={pct(step.destructiveProbability)}
              accent="var(--tag-red-text)"
              hint="Probability the candidate set contains an irreversible action"
            />
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded p-3 flex flex-col gap-1">
            <span className="text-[11px] text-[var(--text-secondary)]">Page context</span>
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {step.pageTitle || "Untitled page"}
            </div>
            <div className="flex items-center gap-1 text-[var(--text-tertiary)] font-mono truncate">
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">{step.url}</span>
            </div>
            {step.pageCategory && (
              <div className="text-[11px] text-[var(--text-tertiary)]">
                Jev page category: <span className="font-mono">{step.pageCategory}</span>
              </div>
            )}
          </div>

          {step.candidates && step.candidates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Observed candidates ({step.candidates.length})
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  Highlighted row is the Jev pick
                </span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {step.candidates.map((cand, idx) => {
                  const isSelected = step.targetActionIndex === idx;
                  return (
                    <div
                      key={cand.id || idx}
                      className={`p-2.5 rounded border text-xs flex items-start gap-2.5 ${
                        isSelected
                          ? "bg-[var(--tag-green-bg)] border-[var(--tag-green-text)]"
                          : "bg-[var(--bg-surface)] border-[var(--border-subtle)]"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <span className="px-1.5 py-0.5 rounded bg-[var(--tag-green-text)] text-white text-[10px] font-bold font-mono">
                            PICK #{idx}
                          </span>
                        ) : (
                          <span className="font-mono text-[var(--text-tertiary)] text-[11px]">#{idx}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--text-primary)]">{cand.description}</div>
                        {cand.selector && (
                          <div className="text-[11px] font-mono text-[var(--text-tertiary)] truncate mt-0.5">
                            {cand.selector}
                            {cand.nth !== undefined && ` [nth=${cand.nth}]`}
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
      </div>
    </div>
  );
}
