"use client";

import React from "react";
import { Play, Square, Globe, Shield, Sparkles, MapPin, Newspaper, Star } from "lucide-react";
import type { FallbackProvider } from "@/types/agent";

export interface ComposerForm {
  goal: string;
  startUrl: string;
  fallback: FallbackProvider;
  headless: boolean;
}

interface ComposerCardProps {
  form: ComposerForm;
  onChange: (patch: Partial<ComposerForm>) => void;
  isRunning: boolean;
  /**
   * Starts a run. `override` is merged over the current form, which lets a preset
   * launch with its own values without waiting for the state update to land.
   */
  onStart: (override?: Partial<ComposerForm>) => void;
  onStop: () => void;
}

const PRESETS: Array<{ label: string; icon: typeof MapPin; iconClass: string; goal: string; url: string }> = [
  {
    label: "Google Maps Distance",
    icon: MapPin,
    iconClass: "text-red-500",
    goal: "Find distance between pcsir phase 1 and cbtl johar town",
    url: "https://www.google.com/maps",
  },
  {
    label: "Hacker News Top Story",
    icon: Newspaper,
    iconClass: "text-amber-500",
    goal: "Find the top story on Hacker News",
    url: "https://news.ycombinator.com",
  },
  {
    label: "GitHub Star Count",
    icon: Star,
    iconClass: "text-yellow-500 fill-yellow-500",
    goal: "Find star count of playwright repo",
    url: "https://github.com/microsoft/playwright",
  },
];

const inputClass =
  "bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] transition-all disabled:opacity-60";

export function ComposerCard({ form, onChange, isRunning, onStart, onStop }: ComposerCardProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.goal.trim()) onStart();
  };

  // While running, the composer collapses to a single status line. Every control
  // in the full form is disabled mid-run, so keeping it expanded only costs the
  // viewport vertical space.
  if (isRunning) {
    return (
      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--tag-amber-text)] animate-pulse shrink-0" />
        <span className="text-xs text-[var(--text-primary)] font-medium truncate flex-1 min-w-0">
          {form.goal}
        </span>
        <button
          type="button"
          onClick={onStop}
          title="Stop the run (Esc)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--tag-red-bg)] text-[var(--tag-red-text)] border border-[var(--border-subtle)] rounded text-xs font-semibold hover:bg-[var(--tag-red-text)] hover:text-white active:scale-[0.98] transition-all cursor-pointer shrink-0"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 flex flex-col gap-3"
    >
      <div className="flex gap-2">
        <input
          id="goal"
          type="text"
          value={form.goal}
          onChange={(e) => onChange({ goal: e.target.value })}
          placeholder="What should the agent do? (e.g. find the top story, calculate a distance)"
          required
          aria-label="Goal or objective"
          className="flex-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] transition-all"
        />
        <button
          type="submit"
          disabled={!form.goal.trim()}
          title={!form.goal.trim() ? "Type a goal to enable" : "Run agent (⌘↵)"}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-canvas)] rounded text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Run Agent</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Start URL (optional)
          </span>
          <input
            type="url"
            value={form.startUrl}
            onChange={(e) => onChange({ startUrl: e.target.value })}
            placeholder="https://www.google.com/maps"
            className={`${inputClass} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[var(--tag-blue-text)]" />
            System 2 fallback
          </span>
          <select
            value={form.fallback}
            onChange={(e) => onChange({ fallback: e.target.value as FallbackProvider })}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="gemini">Google Gemini Flash</option>
            <option value="claude">Anthropic Claude Sonnet (Databricks)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
            <Shield className="w-3 h-3 text-[var(--tag-green-text)]" />
            Browser mode
          </span>
          <select
            value={String(form.headless)}
            onChange={(e) => onChange({ headless: e.target.value === "true" })}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="true">Headless (screencast only)</option>
            <option value="false">Headed (also opens an OS window)</option>
          </select>
        </label>
      </div>

      <div className="flex items-center flex-wrap gap-2 text-xs">
        <span className="text-[var(--text-secondary)]">Presets:</span>
        {PRESETS.map(({ label, icon: Icon, iconClass, goal, url }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              onChange({ goal, startUrl: url });
              onStart({ goal, startUrl: url });
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-active)] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Icon className={`w-3 h-3 ${iconClass}`} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </form>
  );
}
