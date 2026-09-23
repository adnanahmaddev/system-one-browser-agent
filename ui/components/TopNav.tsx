"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon, Laptop, Zap } from "lucide-react";

interface TopNavProps {
  status: "idle" | "connecting" | "running" | "completed" | "error";
  onThemeChange?: (theme: string) => void;
}

export function TopNav({ status }: TopNavProps) {
  const [theme, setTheme] = useState<string>("system");

  useEffect(() => {
    const saved = localStorage.getItem("systemone-theme") || "system";
    setTheme(saved);
  }, []);

  const handleTheme = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("systemone-theme", newTheme);

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effective = newTheme === "system" ? (isDark ? "dark" : "light") : newTheme;

    document.documentElement.setAttribute("data-theme", effective);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", effective);
  };

  const getStatusDisplay = () => {
    switch (status) {
      case "running":
        return { text: "Running...", dotClass: "bg-[#d9730d] dark:bg-[#ffb347] animate-pulse shadow-[0_0_0_2px_rgba(217,115,13,0.2)]" };
      case "connecting":
        return { text: "Connecting...", dotClass: "bg-zinc-400 dark:bg-zinc-600 animate-pulse" };
      case "completed":
        return { text: "Completed", dotClass: "bg-[#0f7b6c] dark:bg-[#4dab9a] shadow-[0_0_0_2px_rgba(15,123,108,0.2)]" };
      case "error":
        return { text: "Error", dotClass: "bg-[#d44c47] dark:bg-[#eb5757]" };
      default:
        return { text: "Ready", dotClass: "bg-[#0f7b6c] dark:bg-[#4dab9a] shadow-[0_0_0_2px_rgba(15,123,108,0.2)]" };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <header className="h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] sticky top-0 z-50 px-4 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
          <span className="text-sm">⚡</span>
          <span className="font-semibold text-[var(--text-primary)]">System One</span>
          <span className="text-[var(--text-tertiary)]">/</span>
          <span>Agent Console</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-hover)] text-[var(--text-secondary)]">
          <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
          <span>{statusInfo.text}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
          <kbd className="font-sans font-semibold text-[var(--text-secondary)]">⌘↵</kbd>
          <span>Run</span>
          <span className="mx-0.5">•</span>
          <kbd className="font-sans font-semibold text-[var(--text-secondary)]">Esc</kbd>
          <span>Stop</span>
        </div>

        <div 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-[var(--border-subtle)] bg-[var(--tag-purple-bg)] text-[var(--tag-purple-text)]"
          title="Parallel TypeSafe AI Jev decision engine reflex"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Jev ~70ms Reflex</span>
        </div>

        {/* Dynamic Theme Segmented Toggle */}
        <div className="flex items-center p-0.5 rounded bg-[var(--bg-hover)] border border-[var(--border-subtle)]">
          <button
            onClick={() => handleTheme("light")}
            className={`p-1 rounded transition-all ${
              theme === "light"
                ? "bg-[var(--bg-canvas)] text-[var(--text-primary)] shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            title="Light Mode"
            aria-label="Light mode"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleTheme("dark")}
            className={`p-1 rounded transition-all ${
              theme === "dark"
                ? "bg-[var(--bg-canvas)] text-[var(--text-primary)] shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            title="Dark Mode"
            aria-label="Dark mode"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleTheme("system")}
            className={`p-1 rounded transition-all ${
              theme === "system"
                ? "bg-[var(--bg-canvas)] text-[var(--text-primary)] shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            title="Follow System Theme"
            aria-label="System mode"
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
