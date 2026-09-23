"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { TopNav } from "@/components/TopNav";
import { ComposerCard } from "@/components/ComposerCard";
import { TelemetryBar } from "@/components/TelemetryBar";
import { LiveViewport } from "@/components/LiveViewport";
import { StepTimeline } from "@/components/StepTimeline";
import { StepInspector } from "@/components/StepInspector";
import { ConsoleDrawer } from "@/components/ConsoleDrawer";
import { ResultBanner } from "@/components/ResultBanner";
import type { StepTelemetry, AgentRunResult, ConsoleLogLine } from "@/types/agent";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "connecting" | "running" | "completed" | "error">("connecting");
  const [isRunning, setIsRunning] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("about:blank");
  const [pageTitle, setPageTitle] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepTelemetry[]>([]);
  const [selectedStep, setSelectedStep] = useState<StepTelemetry | null>(null);
  const [logs, setLogs] = useState<ConsoleLogLine[]>([]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [fallbackProvider, setFallbackProvider] = useState<"gemini" | "claude">("gemini");

  const wsRef = useRef<WebSocket | null>(null);

  const appendLog = useCallback((text: string, forceType?: ConsoleLogLine["type"]) => {
    let type: ConsoleLogLine["type"] = forceType || "system";
    if (!forceType) {
      if (text.includes("✔ [FAST-PATH]")) type = "fastpath";
      else if (text.includes("⚙ [FALLBACK]")) type = "fallback";
      else if (text.includes("🎉") || text.includes("Goal achieved") || text.includes("RUN COMPLETED")) type = "success";
      else if (text.includes("⚠") || text.includes("Destructive")) type = "warn";
    }

    const newLine: ConsoleLogLine = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toTimeString().split(" ")[0],
      text,
      type,
    };

    setLogs((prev) => [...prev, newLine]);
  }, []);

  // WebSocket Connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      setStatus("connecting");
      const host = window.location.hostname || "localhost";
      const wsUrl = `ws://${host}:3001`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("idle");
        appendLog("Connected to System One Agent Service (ws://localhost:3001)", "system");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "status") {
            if (msg.status === "running") {
              setIsRunning(true);
              setStatus("running");
            } else if (msg.status === "completed") {
              setIsRunning(false);
              setStatus("completed");
            } else {
              setIsRunning(false);
              setStatus("idle");
            }
          } else if (msg.type === "clear") {
            setSteps([]);
            setResult(null);
            setScreenshotBase64(null);
          } else if (msg.type === "page") {
            if (msg.url) setCurrentUrl(msg.url);
            if (msg.title) setPageTitle(msg.title);
          } else if (msg.type === "screenshot") {
            if (msg.base64) setScreenshotBase64(msg.base64);
          } else if (msg.type === "step") {
            setSteps((prev) => [...prev, msg.data]);
          } else if (msg.type === "log") {
            appendLog(msg.text);
          } else if (msg.type === "result") {
            setResult(msg.data);
          } else if (msg.type === "error") {
            appendLog(`ERROR: ${msg.error}`, "warn");
            setStatus("error");
          }
        } catch (err) {
          console.error("WS Parse error:", err);
        }
      };

      ws.onclose = () => {
        setStatus("connecting");
        appendLog("Agent service connection dropped. Retrying in 2.5s...", "warn");
        reconnectTimer = setTimeout(connect, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [appendLog]);

  const handleStart = ({
    goal,
    startUrl,
    fallback,
    headless,
  }: {
    goal: string;
    startUrl?: string;
    fallback: "gemini" | "claude";
    headless: boolean;
  }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("Agent service is not connected. Please ensure the agent backend is running on port 3001.");
      return;
    }

    setFallbackProvider(fallback);
    setResult(null);
    setSteps([]);

    wsRef.current.send(
      JSON.stringify({
        type: "start",
        goal,
        startUrl,
        fallback,
        headless,
      })
    );
  };

  const handleStop = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNav status={status} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Document Header */}
        <section className="space-y-1.5">
          <div className="text-3xl select-none">🤖</div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Autonomous Browser Agent
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl leading-relaxed">
            Dual-process browser automation harness. Sub-150ms reflexive element choices are resolved by{" "}
            <strong className="text-[var(--text-primary)]">TypeSafe AI Jev</strong>, while complex creative reasoning escalates to{" "}
            <strong className="text-[var(--text-primary)]">System 2</strong> (Gemini Flash or Claude Sonnet).
          </p>
        </section>

        {/* Telemetry Speedometer */}
        <TelemetryBar steps={steps} isRunning={isRunning} fallbackProvider={fallbackProvider} />

        {/* Goal Composer Callout */}
        <ComposerCard isRunning={isRunning} onStart={handleStart} onStop={handleStop} />

        {/* Goal Result Banner */}
        <ResultBanner result={result} />

        {/* Two-Column Grid: Live Viewport + Steps / Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Live Browser Viewport */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              <span>Live Browser Viewport</span>
              {isRunning && (
                <span className="text-[11px] font-mono text-[var(--tag-green-text)] lowercase">
                  active screencast (400ms)
                </span>
              )}
            </div>
            <LiveViewport
              screenshotBase64={screenshotBase64}
              currentUrl={currentUrl}
              isRunning={isRunning}
              pageTitle={pageTitle}
            />
          </section>

          {/* Right Column: Steps Timeline & Console Logs */}
          <section className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                <span>Executed Steps & Reflex Telemetry</span>
                <span className="text-[11px] font-mono text-[var(--text-tertiary)] lowercase">
                  click step to inspect
                </span>
              </div>
              <StepTimeline steps={steps} onSelectStep={(step) => setSelectedStep(step)} />
            </div>

            <ConsoleDrawer logs={logs} onClear={() => setLogs([])} />
          </section>
        </div>
      </main>

      {/* Interactive Step Inspector Modal */}
      <StepInspector step={selectedStep} onClose={() => setSelectedStep(null)} />
    </div>
  );
}
