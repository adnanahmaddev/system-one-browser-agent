"use client";

import React, { useState } from "react";
import { Lock, Copy, Check, Maximize2, Minimize2, Monitor } from "lucide-react";

interface LiveViewportProps {
  screenshotBase64: string | null;
  currentUrl: string;
  isRunning: boolean;
  pageTitle?: string;
}

export function LiveViewport({
  screenshotBase64,
  currentUrl,
  isRunning,
  pageTitle,
}: LiveViewportProps) {
  const [copied, setCopied] = useState(false);
  const [isTheater, setIsTheater] = useState(false);

  const copyUrl = async () => {
    if (!currentUrl || currentUrl === "about:blank") return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg overflow-hidden flex flex-col shadow-xs transition-all ${
        isTheater ? "fixed inset-4 z-50 shadow-2xl bg-[var(--bg-canvas)]" : ""
      }`}
    >
      {/* Browser Chrome Header */}
      <div className="h-10 px-3 bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 select-none">
        {/* Window Dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] opacity-80" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] opacity-80" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] opacity-80" />
        </div>

        {/* Address Bar */}
        <div className="flex-1 max-w-xl mx-auto h-7 px-2.5 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Lock className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
            <span className="text-xs font-mono text-[var(--text-secondary)] truncate">
              {currentUrl || "about:blank"}
            </span>
          </div>

          {currentUrl && currentUrl !== "about:blank" && (
            <button
              onClick={copyUrl}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-0.5 cursor-pointer shrink-0"
              title="Copy URL"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Viewport Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsTheater(!isTheater)}
            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
            title={isTheater ? "Exit Theater Mode" : "Expand Theater Mode"}
          >
            {isTheater ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Screen Canvas Container */}
      <div className="relative w-full aspect-16/10 bg-black flex items-center justify-center overflow-hidden flex-1">
        {screenshotBase64 ? (
          <img
            src={`data:image/jpeg;base64,${screenshotBase64}`}
            alt="Live agent browser screencast"
            className="w-full h-full object-contain select-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Monitor className="w-10 h-10 mb-2 opacity-40 text-zinc-400" />
            <div className="text-sm font-medium text-zinc-300">Live Agent Viewport</div>
            <div className="text-xs text-zinc-500 max-w-xs mt-1">
              Browser actions, typing, and navigation stream here in real time as the agent runs.
            </div>
          </div>
        )}

        {/* Live Pulse Badge */}
        {isRunning && (
          <div className="absolute top-2.5 right-2.5 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 tracking-wider backdrop-blur-xs select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>LIVE</span>
          </div>
        )}

        {/* Page Title Overlay in Theater Mode */}
        {pageTitle && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-zinc-300 text-[11px] px-2 py-0.5 rounded font-mono truncate max-w-sm pointer-events-none">
            {pageTitle}
          </div>
        )}
      </div>
    </div>
  );
}
