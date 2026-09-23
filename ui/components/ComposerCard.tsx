"use client";

import React, { useState, useEffect } from "react";
import { Play, Square, Globe, Shield, Sparkles, MapPin, Newspaper, Star } from "lucide-react";

interface ComposerCardProps {
  isRunning: boolean;
  onStart: (params: {
    goal: string;
    startUrl?: string;
    fallback: "gemini" | "claude";
    headless: boolean;
  }) => void;
  onStop: () => void;
}

export function ComposerCard({ isRunning, onStart, onStop }: ComposerCardProps) {
  const [goal, setGoal] = useState("Find distance between pcsir phase 1 and cbtl johar town");
  const [startUrl, setStartUrl] = useState("https://www.google.com/maps");
  const [fallback, setFallback] = useState<"gemini" | "claude">("gemini");
  const [headless, setHeadless] = useState<boolean>(true);

  // Keyboard shortcut listener: Cmd/Ctrl + Enter to run, Escape to stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isRunning && goal.trim()) {
          onStart({ goal: goal.trim(), startUrl: startUrl.trim() || undefined, fallback, headless });
        }
      } else if (e.key === "Escape" && isRunning) {
        e.preventDefault();
        onStop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, goal, startUrl, fallback, headless, onStart, onStop]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    onStart({
      goal: goal.trim(),
      startUrl: startUrl.trim() || undefined,
      fallback,
      headless,
    });
  };

  const applyPreset = (presetGoal: string, presetUrl: string) => {
    setGoal(presetGoal);
    setStartUrl(presetUrl);
    onStart({
      goal: presetGoal,
      startUrl: presetUrl,
      fallback,
      headless,
    });
  };

  return (
    <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-5 shadow-xs transition-colors">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="goal" className="text-[11px] font-semibold tracking-wider uppercase text-[var(--text-secondary)]">
              Goal / Objective
            </label>
            <span className="text-[11px] text-[var(--text-tertiary)] hidden sm:inline">
              Press <kbd className="font-mono bg-[var(--bg-hover)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold">⌘↵</kbd> to launch
            </span>
          </div>

          <div className="flex gap-2">
            <input
              id="goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Enter your browser goal here (e.g. Find top story, calculate distance)..."
              required
              disabled={isRunning}
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-default)] transition-all disabled:opacity-60"
            />

            {!isRunning ? (
              <button
                type="submit"
                disabled={!goal.trim()}
                title={!goal.trim() ? "Type a goal to enable" : "Run Agent (⌘↵)"}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-canvas)] rounded text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Agent</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--tag-red-bg)] text-[var(--tag-red-text)] border border-[var(--border-subtle)] rounded text-xs font-semibold hover:bg-[var(--tag-red-text)] hover:text-white active:scale-[0.98] transition-all cursor-pointer shadow-xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Parameters Drawer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <label htmlFor="startUrl" className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>Start URL (Optional)</span>
            </label>
            <input
              id="startUrl"
              type="url"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://www.google.com/maps"
              disabled={isRunning}
              className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] transition-all disabled:opacity-60 font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="fallback" className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#0b6e99] dark:text-[#529cca]" />
              <span>System 2 Fallback</span>
            </label>
            <select
              id="fallback"
              value={fallback}
              onChange={(e) => setFallback(e.target.value as "gemini" | "claude")}
              disabled={isRunning}
              className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-60"
            >
              <option value="gemini">Google Gemini Flash (Medium Thinking)</option>
              <option value="claude">Anthropic Claude Sonnet (Databricks AI Gateway)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="headless" className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#0f7b6c] dark:text-[#4dab9a]" />
              <span>Browser Mode</span>
            </label>
            <select
              id="headless"
              value={String(headless)}
              onChange={(e) => setHeadless(e.target.value === "true")}
              disabled={isRunning}
              className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-60"
            >
              <option value="true">Headless (Smooth Screencast in UI)</option>
              <option value="false">Headed (Live OS Window + Screencast)</option>
            </select>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-[var(--border-subtle)] text-xs">
          <span className="text-[var(--text-secondary)] font-medium">Quick presets:</span>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => applyPreset("Find distance between pcsir phase 1 and cbtl johar town", "https://www.google.com/maps")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-active)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <MapPin className="w-3 h-3 text-red-500" />
            <span>Google Maps Distance</span>
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => applyPreset("Find the top story on Hacker News", "https://news.ycombinator.com")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-active)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <Newspaper className="w-3 h-3 text-amber-500" />
            <span>Hacker News Top Story</span>
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => applyPreset("Find star count of playwright repo", "https://github.com/microsoft/playwright")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-active)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span>GitHub Star Count</span>
          </button>
        </div>
      </form>
    </section>
  );
}
