"use client";

import React, { useState } from "react";
import { Lock, Copy, Check, Maximize2, Minimize2, Monitor } from "lucide-react";

interface LiveViewportProps {
  screenshotBase64: string | null;
  currentUrl: string;
  isRunning: boolean;
  pageTitle?: string;
  isTheater: boolean;
  onToggleTheater: () => void;
}

export function LiveViewport({
  screenshotBase64,
  currentUrl,
  isRunning,
  pageTitle,
  isTheater,
  onToggleTheater,
}: LiveViewportProps) {
  const [copied, setCopied] = useState(false);
  const hasUrl = Boolean(currentUrl) && currentUrl !== "about:blank";

  const copyUrl = async () => {
    if (!hasUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; nothing useful to surface here.
    }
  };

  return (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden flex flex-col min-h-0 ${
        isTheater ? "fixed inset-3 z-40 rounded-lg shadow-2xl" : "h-full rounded"
      }`}
    >
      <div className="h-9 shrink-0 px-2.5 bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] flex items-center gap-3 select-none">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] opacity-80" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] opacity-80" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] opacity-80" />
        </div>

        <div className="flex-1 min-w-0 h-6 px-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Lock className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
            <span className="text-[11px] font-mono text-[var(--text-secondary)] truncate">
              {currentUrl || "about:blank"}
            </span>
          </div>

          {hasUrl && (
            <button
              onClick={copyUrl}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-0.5 cursor-pointer shrink-0"
              title="Copy URL"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>

        {isRunning && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600/90 text-white tracking-wider shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        )}

        <button
          onClick={onToggleTheater}
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer shrink-0"
          title={isTheater ? "Exit theater mode (Esc)" : "Expand to theater mode"}
        >
          {isTheater ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
        {screenshotBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element -- streamed base64 frame, not a static asset
          <img
            src={`data:image/jpeg;base64,${screenshotBase64}`}
            alt="Live agent browser screencast"
            className="max-w-full max-h-full object-contain select-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6">
            <Monitor className="w-10 h-10 mb-2 opacity-40 text-zinc-400" />
            <div className="text-sm font-medium text-zinc-300">Live Agent Viewport</div>
            <div className="text-xs text-zinc-500 max-w-xs mt-1">
              Browser actions, typing, and navigation stream here as the agent runs.
            </div>
          </div>
        )}

        {pageTitle && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-zinc-300 text-[11px] px-2 py-0.5 rounded font-mono truncate max-w-sm pointer-events-none">
            {pageTitle}
          </div>
        )}
      </div>
    </div>
  );
}
