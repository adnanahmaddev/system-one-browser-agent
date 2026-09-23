"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, Copy, Check, Download, Sparkles } from "lucide-react";
import type { AgentRunResult } from "@/types/agent";

interface ResultBannerProps {
  result: AgentRunResult | null;
}

export function ResultBanner({ result }: ResultBannerProps) {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const totalSeconds = (result.totalLatencyMs / 1000).toFixed(1);
  const s1Ratio =
    result.totalSteps > 0
      ? Math.round((result.system1StepCount / result.totalSteps) * 100)
      : 0;

  const copyResult = async () => {
    const text = typeof result.extractedData === "object"
      ? JSON.stringify(result.extractedData, null, 2)
      : String(result.extractedData || result.terminationReason);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `system-one-run-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <section className="bg-[var(--tag-green-bg)] border border-[var(--tag-green-text)] rounded-lg p-5 transition-all shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {result.success ? (
            <div className="p-1 rounded bg-[var(--tag-green-text)] text-white mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1 rounded bg-[var(--tag-red-text)] text-white mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}

          <div>
            <h2 className="text-sm font-bold text-[var(--tag-green-text)] flex items-center gap-1.5">
              <span>{result.success ? "Goal Completed Successfully" : "Agent Execution Terminated"}</span>
            </h2>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
              {result.totalSteps} steps • {totalSeconds}s total • {s1Ratio}% System 1 Fast-Path ({result.system1StepCount} S1 / {result.system2StepCount} S2)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyResult}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] hover:border-[var(--border-default)] transition-all cursor-pointer font-medium shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Result"}</span>
          </button>

          <button
            onClick={downloadJson}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] hover:border-[var(--border-default)] transition-all cursor-pointer font-medium shadow-2xs"
            title="Download Run Telemetry JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {result.extractedData && (
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#0f7b6c] dark:text-[#4dab9a]" />
            <span>Extracted Answer</span>
          </div>

          <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded p-3 font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
            {typeof result.extractedData === "object"
              ? JSON.stringify(result.extractedData, null, 2)
              : String(result.extractedData)}
          </div>
        </div>
      )}
    </section>
  );
}
