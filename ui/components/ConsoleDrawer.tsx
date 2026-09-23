"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Copy, Check, Trash2, ChevronDown, ChevronUp, Search } from "lucide-react";
import type { ConsoleLogLine } from "@/types/agent";

interface ConsoleDrawerProps {
  logs: ConsoleLogLine[];
  onClear: () => void;
}

const LINE_COLORS: Record<ConsoleLogLine["type"], string> = {
  system: "text-zinc-400",
  fastpath: "text-[#4dab9a]",
  fallback: "text-[#529cca]",
  success: "text-[#a8df8e] font-semibold",
  warn: "text-[#eb5757]",
};

/**
 * Memoized because the 400ms screencast frame re-renders the page on a timer,
 * and re-rendering a thousand log lines with it is pure waste.
 */
export const ConsoleDrawer = React.memo(function ConsoleDrawer({
  logs,
  onClear,
}: ConsoleDrawerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logs.map((l) => `[${l.timestamp}] ${l.text}`).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; nothing useful to surface here.
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = query ? logs.filter((l) => l.text.toLowerCase().includes(query)) : logs;

  return (
    <div className="shrink-0 bg-[var(--terminal-bg)] border-t border-[var(--border-subtle)] flex flex-col font-mono text-xs">
      <div className="h-8 shrink-0 px-2.5 bg-[#141414] border-b border-white/5 flex items-center justify-between gap-2 text-[var(--terminal-dim)]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="font-semibold text-zinc-300 text-[11px]">Logs</span>
          <span className="text-[10px] text-zinc-500">
            {query ? `${filtered.length}/${logs.length}` : logs.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isOpen && (
            <div className="relative flex items-center">
              <Search className="w-2.5 h-2.5 absolute left-1.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter..."
                aria-label="Filter logs"
                className="w-20 sm:w-28 bg-zinc-900 border border-zinc-700/60 rounded px-1.5 py-0.5 pl-5 text-[10px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
            </div>
          )}

          <button onClick={copyLogs} title="Copy logs" className="p-1 hover:text-zinc-200 cursor-pointer">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <button onClick={onClear} title="Clear logs" className="p-1 hover:text-zinc-200 cursor-pointer">
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsOpen((v) => !v)}
            title={isOpen ? "Collapse logs" : "Expand logs"}
            className="p-1 hover:text-zinc-200 cursor-pointer"
          >
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          ref={scrollRef}
          className="h-40 overflow-y-auto p-2.5 flex flex-col gap-1 text-[11px] leading-relaxed select-text"
        >
          {filtered.length === 0 ? (
            <div className="text-zinc-600 italic">
              {logs.length === 0 ? "Waiting for agent output..." : "No matching log lines."}
            </div>
          ) : (
            filtered.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
                <span className={`${LINE_COLORS[log.type]} break-all whitespace-pre-wrap`}>
                  {log.text}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});
