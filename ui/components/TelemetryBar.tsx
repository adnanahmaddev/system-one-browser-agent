"use client";

import React from "react";
import { FALLBACK_LABELS, type FallbackProvider, type StepTelemetry } from "@/types/agent";

interface TelemetryBarProps {
  steps: StepTelemetry[];
  fallbackProvider: FallbackProvider;
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0" title={hint}>
      <span className="text-[11px] text-[var(--text-secondary)] shrink-0">{label}</span>
      <span
        className="text-xs font-mono font-semibold truncate"
        style={{ color: accent ?? "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Compact run metrics. Deliberately one dense row rather than a grid of cards:
 * these are four numbers, and the vertical space is worth more to the viewport.
 */
export const TelemetryBar = React.memo(function TelemetryBar({
  steps,
  fallbackProvider,
}: TelemetryBarProps) {
  const s1Count = steps.filter((s) => s.decisionPath === "SYSTEM_1_JEV").length;
  const s2Count = steps.filter((s) => s.decisionPath === "SYSTEM_2_GEMINI_FALLBACK").length;

  // Ratio over action steps only — terminal pseudo-steps took no action.
  const actionSteps = s1Count + s2Count;
  const s1Percentage = actionSteps > 0 ? Math.round((s1Count / actionSteps) * 100) : 0;

  const avg = (pick: (s: StepTelemetry) => number) =>
    steps.length > 0 ? Math.round(steps.reduce((acc, s) => acc + pick(s), 0) / steps.length) : 0;

  const avgJev = avg((s) => s.jevLatencyMs);
  const avgObserve = avg((s) => s.observeLatencyMs);
  const avgStep = avg((s) => s.latencyMs);
  const dash = steps.length === 0;

  return (
    <div className="shrink-0 h-9 px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-x-5 gap-y-1 overflow-x-auto text-xs">
      <Metric
        label="Steps"
        value={dash ? "—" : `${steps.length}`}
        hint="Steps recorded this run, including the terminal step"
      />
      <Metric
        label="Fast-path"
        value={dash ? "—" : `${s1Percentage}% (${s1Count}/${actionSteps})`}
        accent="var(--tag-green-text)"
        hint="Share of actions resolved by Jev without escalating to System 2"
      />
      <Metric
        label="Jev reflex"
        value={dash ? "—" : `${avgJev}ms`}
        accent="var(--tag-purple-text)"
        hint="Average time inside the Jev System One call — the actual reflex latency"
      />
      <Metric
        label="observe() LLM"
        value={dash ? "—" : `${avgObserve}ms`}
        accent="var(--tag-amber-text)"
        hint="Average Stagehand observe() round-trip. Paid on every step, before Jev is consulted."
      />
      <Metric
        label="Total/step"
        value={dash ? "—" : `${avgStep}ms`}
        hint="Average wall-clock per step: observe() + Jev + the action itself"
      />

      <div className="ml-auto flex items-center gap-1.5 shrink-0 text-[11px] text-[var(--text-secondary)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--tag-green-text)]" />
        <span className="hidden sm:inline">Jev</span>
        <span className="text-[var(--text-tertiary)]">+</span>
        <span>{FALLBACK_LABELS[fallbackProvider]}</span>
      </div>
    </div>
  );
});
