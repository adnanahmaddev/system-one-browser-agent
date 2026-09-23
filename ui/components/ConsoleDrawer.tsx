"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Copy, Check, Trash2, ChevronDown, ChevronUp, Search } from "lucide-react";
import type { ConsoleLogLine } from "@/types/agent";

interface ConsoleDrawerProps {
  logs: ConsoleLogLine[];
  onClear: () => void;
}

export function ConsoleDrawer({ logs, onClear }: ConsoleDrawerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const copyLogs = async () => {
    const raw = logs.map((l) => `[${l.timestamp}] ${l.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const filteredLogs = logs.filter((l) =>
    l.text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-[var(--terminal-bg)] border border-[var(--border-subtle)] rounded-lg overflow-hidden flex flex-col font-mono text-xs shadow-xs">
      {/* Console Header */}
      <div className="h-8 px-3 bg-[#141414] border-b border-white/5 flex items-center justify-between text-[var(--terminal-dim)]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-semibold text-zinc-300 text-[11px]">Execution Logs</span>
          <span className="text-[10px] text-zinc-500">({logs.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <div className="relative flex items-center">
              <Search className="w-2.5 h-2.5 absolute left-1.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter logs..."
                className="w-24 sm:w-32 bg-zinc-900 border border-zinc-700/60 rounded px-1.5 py-0.5 pl-5 text-[10px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
              />
            </div>
          )}

          <button
            onClick={copyLogs}
            className="p-1 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Copy Logs"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={onClear}
            className="p-1 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Clear Logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Output Stream */}
      {isOpen && (
        <div
          ref={scrollRef}
          className="h-44 overflow-y-auto p-3 flex flex-col gap-1 text-[11px] leading-relaxed select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-zinc-600 italic">No matching log messages...</div>
          ) : (
            filteredLogs.map((log) => {
              let colorClass = "text-zinc-400";
              if (log.type === "fastpath") colorClass = "text-[#4dab9a]";
              else if (log.type === "fallback") colorClass = "text-[#529cca]";
              else if (log.type === "success") colorClass = "text-[#a8df8e] font-semibold";
              else if (log.type === "warn") colorClass = "text-[#eb5757]";

              return (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
                  <span className={`${colorClass} break-all whitespace-pre-wrap`}>{log.text}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
