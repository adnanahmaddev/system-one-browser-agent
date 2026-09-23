"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { TopNav } from "@/components/TopNav";
import { ComposerCard, type ComposerForm } from "@/components/ComposerCard";
import { TelemetryBar } from "@/components/TelemetryBar";
import { LiveViewport } from "@/components/LiveViewport";
import { StepTimeline } from "@/components/StepTimeline";
import { StepInspector } from "@/components/StepInspector";
import { ConsoleDrawer } from "@/components/ConsoleDrawer";
import { ResultBanner } from "@/components/ResultBanner";
import type {
  StepTelemetry,
  AgentRunResult,
  ConsoleLogLine,
  ConnectionStatus,
} from "@/types/agent";

/** Keeps the log buffer from growing without bound over a long session. */
const MAX_LOG_LINES = 1000;

const INITIAL_FORM: ComposerForm = {
  goal: "",
  startUrl: "",
  fallback: "gemini",
  headless: true,
};

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [form, setForm] = useState<ComposerForm>(INITIAL_FORM);
  const [currentUrl, setCurrentUrl] = useState("about:blank");
  const [pageTitle, setPageTitle] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepTelemetry[]>([]);
  const [selectedStep, setSelectedStep] = useState<StepTelemetry | null>(null);
  const [logs, setLogs] = useState<ConsoleLogLine[]>([]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [isTheater, setIsTheater] = useState(false);

  // `status` is the single source of truth — a separate isRunning flag could
  // disagree with it after an error frame.
  const isRunning = status === "running";

  const wsRef = useRef<WebSocket | null>(null);

  const appendLog = useCallback((text: string, forceType?: ConsoleLogLine["type"]) => {
    let type: ConsoleLogLine["type"] = forceType || "system";
    if (!forceType) {
      if (text.includes("✔ [FAST-PATH]")) type = "fastpath";
      else if (text.includes("⚙ [FALLBACK]")) type = "fallback";
      else if (text.includes("🎉") || text.includes("Goal achieved") || text.includes("SUCCEEDED"))
        type = "success";
      else if (text.includes("⚠") || text.includes("Destructive")) type = "warn";
    }

    const line: ConsoleLogLine = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toTimeString().split(" ")[0],
      text,
      type,
    };

    setLogs((prev) => (prev.length >= MAX_LOG_LINES ? [...prev.slice(1), line] : [...prev, line]));
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    // Guards against a reconnect firing after the effect has been torn down,
    // which would otherwise leave an orphaned socket setting state.
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");
      const host = window.location.hostname || "localhost";
      ws = new WebSocket(`ws://${host}:3001`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("idle");
        appendLog("Connected to System One agent service (ws://localhost:3001)", "system");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "status":
              if (msg.status === "running") setStatus("running");
              else if (msg.status === "completed") setStatus("completed");
              else if (msg.status === "error") setStatus("error");
              else setStatus("idle");
              break;
            case "clear":
              setSteps([]);
              setResult(null);
              setScreenshotBase64(null);
              setSelectedStep(null);
              break;
            case "page":
              if (msg.url) setCurrentUrl(msg.url);
              if (msg.title) setPageTitle(msg.title);
              break;
            case "screenshot":
              if (msg.base64) setScreenshotBase64(msg.base64);
              break;
            case "step":
              setSteps((prev) => [...prev, msg.data]);
              break;
            case "log":
              appendLog(msg.text);
              break;
            case "result":
              setResult(msg.data);
              break;
            case "error":
              appendLog(`ERROR: ${msg.error}`, "warn");
              setStatus("error");
              break;
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus("connecting");
        appendLog("Agent service connection dropped. Retrying in 2.5s...", "warn");
        reconnectTimer = setTimeout(connect, 2500);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [appendLog]);

  const handleStart = useCallback(
    (override?: Partial<ComposerForm>) => {
      const next = { ...form, ...override };
      if (!next.goal.trim()) return;

      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        appendLog("Cannot start: agent service is not connected on port 3001.", "warn");
        return;
      }

      setResult(null);
      setSteps([]);
      setSelectedStep(null);

      socket.send(
        JSON.stringify({
          type: "start",
          goal: next.goal,
          startUrl: next.startUrl || undefined,
          fallback: next.fallback,
          headless: next.headless,
        })
      );
    },
    [form, appendLog]
  );

  const handleStop = useCallback(() => {
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop" }));
    }
  }, []);

  // Owned here rather than in the composer so Escape can be prioritised
  // against modal and theater state, which the composer cannot see.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isRunning) handleStart();
        return;
      }
      if (e.key === "Escape") {
        if (selectedStep) setSelectedStep(null);
        else if (isTheater) setIsTheater(false);
        else if (isRunning) handleStop();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRunning, isTheater, selectedStep, handleStart, handleStop]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNav status={status} />

      <ComposerCard
        form={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        isRunning={isRunning}
        onStart={handleStart}
        onStop={handleStop}
      />

      <TelemetryBar steps={steps} fallbackProvider={form.fallback} />

      {/* minmax(0,1fr) rather than 1fr: grid items default to min-width:auto, so a
          wide child — a 1280px screencast frame, or a long unbroken Maps URL —
          expands the track and pushes the sidebar off-screen. */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] overflow-hidden">
        <div className="min-h-0 min-w-0 overflow-hidden p-2">
          <LiveViewport
            screenshotBase64={screenshotBase64}
            currentUrl={currentUrl}
            isRunning={isRunning}
            pageTitle={pageTitle}
            isTheater={isTheater}
            onToggleTheater={() => setIsTheater((v) => !v)}
          />
        </div>

        {/* The column itself does not scroll: the step list owns the only scroll
            area, so the result banner and the log drawer stay pinned in view. */}
        <aside className="min-h-0 min-w-0 flex flex-col overflow-hidden border-l border-[var(--border-subtle)]">
          <ResultBanner result={result} />
          <StepTimeline steps={steps} onSelectStep={setSelectedStep} />
          <ConsoleDrawer logs={logs} onClear={() => setLogs([])} />
        </aside>
      </main>

      {isTheater && (
        <div
          className="fixed inset-0 z-30 bg-black/70"
          onClick={() => setIsTheater(false)}
          aria-hidden
        />
      )}

      <StepInspector step={selectedStep} onClose={() => setSelectedStep(null)} />
    </div>
  );
}
