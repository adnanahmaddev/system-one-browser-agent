"use client";

import React, { useSyncExternalStore } from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import {
  applyTheme,
  getServerThemeSnapshot,
  readStoredTheme,
  storeTheme,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";
import type { ConnectionStatus } from "@/types/agent";

const STATUS_DISPLAY: Record<ConnectionStatus, { text: string; dotClass: string }> = {
  running: { text: "Running", dotClass: "bg-[var(--tag-amber-text)] animate-pulse" },
  connecting: { text: "Connecting", dotClass: "bg-zinc-400 dark:bg-zinc-600 animate-pulse" },
  completed: { text: "Completed", dotClass: "bg-[var(--tag-green-text)]" },
  error: { text: "Failed", dotClass: "bg-[var(--tag-red-text)]" },
  idle: { text: "Ready", dotClass: "bg-[var(--tag-green-text)]" },
};

const THEME_OPTIONS: Array<{ value: ThemePreference; icon: typeof Sun; label: string }> = [
  { value: "light", icon: Sun, label: "Light mode" },
  { value: "dark", icon: Moon, label: "Dark mode" },
  { value: "system", icon: Laptop, label: "Follow system theme" },
];

export function TopNav({ status }: { status: ConnectionStatus }) {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, getServerThemeSnapshot);

  const handleTheme = (next: ThemePreference) => {
    // storeTheme notifies the store, which re-renders this control.
    storeTheme(next);
    applyTheme(next);
  };

  const statusInfo = STATUS_DISPLAY[status];

  return (
    <header className="h-11 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 flex items-center justify-between gap-3 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] shrink-0">
          <span className="text-sm">⚡</span>
          <span className="font-semibold text-[var(--text-primary)]">System One</span>
          <span className="text-[var(--text-tertiary)]">/</span>
          <span className="hidden sm:inline">Agent Console</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-hover)] text-[var(--text-secondary)] shrink-0">
          <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
          <span>{statusInfo.text}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
          <kbd className="font-sans font-semibold text-[var(--text-secondary)]">⌘↵</kbd>
          <span>Run</span>
          <span className="mx-0.5">•</span>
          <kbd className="font-sans font-semibold text-[var(--text-secondary)]">Esc</kbd>
          <span>Stop</span>
        </div>

        <div className="flex items-center p-0.5 rounded bg-[var(--bg-hover)] border border-[var(--border-subtle)]">
          {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => handleTheme(value)}
              className={`p-1 rounded transition-all cursor-pointer ${
                theme === value
                  ? "bg-[var(--bg-canvas)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title={label}
              aria-label={label}
              aria-pressed={theme === value}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
