"use client";

import React from "react";
import { Zap, Cpu, Gauge, Activity } from "lucide-react";
import type { StepTelemetry } from "@/types/agent";

interface TelemetryBarProps {
  steps: StepTelemetry[];
  isRunning: boolean;
  fallbackProvider: "gemini" | "claude";
}

export function TelemetryBar({ steps, isRunning, fallbackProvider }: TelemetryBarProps) {
  const totalSteps = steps.length;
  const s1Count = steps.filter((s) => s.decisionPath === "SYSTEM_1_JEV").length;
  const s2Count = steps.filter((s) => s.decisionPath === "SYSTEM_2_GEMINI_FALLBACK").length;

  const s1Percentage = totalSteps > 0 ? Math.round((s1Count / totalSteps) * 100) : 0;
  const avgLatency =
    totalSteps > 0
      ? Math.round(steps.reduce((acc, s) => acc + s.latencyMs, 0) / totalSteps)
      : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Fast-Path Ratio */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-3 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-medium">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#0f7b6c] dark:text-[#4dab9a]" />
            <span>Fast-Path Ratio</span>
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">&lt;150ms</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-[var(--tag-green-text)]">
            {totalSteps > 0 ? `${s1Percentage}%` : "—"}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)]">
            ({s1Count} S1 / {s2Count} S2)
          </span>
        </div>
      </div>

      {/* Avg Decision Latency */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-3 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-medium">
          <span className="flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-[#6940a5] dark:text-[#9a6dd7]" />
            <span>Avg Step Latency</span>
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">per step</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
            {totalSteps > 0 ? `${avgLatency}ms` : "—"}
          </span>
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--tag-amber-text)] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tag-amber-text)] animate-ping" />
              active
            </span>
          )}
        </div>
      </div>

      {/* Executed Steps */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-3 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-medium">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#0b6e99] dark:text-[#529cca]" />
            <span>Executed Steps</span>
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">progress</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
            {totalSteps}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)]">actions taken</span>
        </div>
      </div>

      {/* Dual Engines Status */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-3 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-medium">
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span>Active Architecture</span>
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--tag-green-text)]">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>S1: Jev (TypeSafe AI)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            <span>S2: {fallbackProvider === "claude" ? "Claude Sonnet (Databricks)" : "Gemini Flash"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
