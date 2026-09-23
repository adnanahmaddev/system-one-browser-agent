"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, Copy, Check, Download } from "lucide-react";
import type { AgentRunResult, RunOutcome } from "@/types/agent";

interface ResultBannerProps {
  result: AgentRunResult | null;
}

const OUTCOME_LABELS: Record<RunOutcome, string> = {
  completed: "Goal completed",
  max_steps_exhausted: "Step budget exhausted",
  stagnated: "Page stopped changing",
  anti_bot_blocked: "Blocked by bot detection",
  guardrail_blocked: "Guardrail blocked",
  aborted: "Stopped by operator",
  error: "Run failed",
};

export function ResultBanner({ result }: ResultBannerProps) {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  // Colour follows `success`, not the presence of a result: a run that ended on
  // a guardrail or an abort is not a green outcome.
  const ok = result.success;
  const bg = ok ? "var(--tag-green-bg)" : "var(--tag-red-bg)";
  const fg = ok ? "var(--tag-green-text)" : "var(--tag-red-text)";

  const totalSeconds = (result.totalLatencyMs / 1000).toFixed(1);
  const s1Percent = Math.round(result.system1Ratio * 100);

  const copyResult = async () => {
    const text =
      result.extractedData && typeof result.extractedData === "object"
        ? JSON.stringify(result.extractedData, null, 2)
        : String(result.extractedData ?? result.terminationReason);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; nothing useful to surface here.
    }
  };

  const downloadJson = () => {
    const href =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const anchor = document.createElement("a");
    anchor.setAttribute("href", href);
    anchor.setAttribute("download", `system-one-run-${Date.now()}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <section
      className="shrink-0 border-b border-[var(--border-subtle)] p-3 flex flex-col gap-2"
      style={{ backgroundColor: bg }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {ok ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: fg }} />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: fg }} />
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold" style={{ color: fg }}>
              {OUTCOME_LABELS[result.outcome] ?? result.outcome}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {result.terminationReason}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={copyResult}
            title="Copy the extracted answer"
            className="p-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-default)] transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={downloadJson}
            title="Export full run telemetry as JSON"
            className="p-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-default)] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="text-[11px] font-mono text-[var(--text-secondary)]">
        {result.totalSteps} steps • {totalSeconds}s • {s1Percent}% fast-path (
        {result.system1StepCount} S1 / {result.system2StepCount} S2)
      </div>

      {result.extractedData !== undefined && result.extractedData !== null && (
        <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded p-2 font-mono text-[11px] text-[var(--text-primary)] whitespace-pre-wrap break-words max-h-44 overflow-y-auto">
          {typeof result.extractedData === "object"
            ? JSON.stringify(result.extractedData, null, 2)
            : String(result.extractedData)}
        </div>
      )}
    </section>
  );
}
