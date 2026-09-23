// ==========================================================================
// System One — Notion Minimalist Web UI Controller
// ==========================================================================

(() => {
  // Elements
  const htmlRoot = document.documentElement;
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  const themeBtns = document.querySelectorAll(".theme-btn");

  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  const agentForm = document.getElementById("agentForm");
  const goalInput = document.getElementById("goalInput");
  const urlInput = document.getElementById("urlInput");
  const fallbackSelect = document.getElementById("fallbackSelect");
  const headlessSelect = document.getElementById("headlessSelect");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  const liveViewportImg = document.getElementById("liveViewportImg");
  const viewportPlaceholder = document.getElementById("viewportPlaceholder");
  const recordingBadge = document.getElementById("recordingBadge");
  const urlDisplay = document.getElementById("urlDisplay");

  const stepsTimeline = document.getElementById("stepsTimeline");
  const timelineEmpty = document.getElementById("timelineEmpty");
  const s1Stat = document.getElementById("s1Stat");
  const s2Stat = document.getElementById("s2Stat");

  const consoleOutput = document.getElementById("consoleOutput");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  const resultCard = document.getElementById("resultCard");
  const resultIcon = document.getElementById("resultIcon");
  const resultTitle = document.getElementById("resultTitle");
  const resultMeta = document.getElementById("resultMeta");
  const resultBody = document.getElementById("resultBody");

  const presetTags = document.querySelectorAll(".preset-tag");

  // State
  let ws = null;
  let s1Count = 0;
  let s2Count = 0;
  let currentThemeSetting = localStorage.getItem("systemone-theme") || "system";

  // ==========================================================================
  // Dynamic Theme Controller
  // ==========================================================================

  function applyTheme(themeVal) {
    currentThemeSetting = themeVal;
    localStorage.setItem("systemone-theme", themeVal);

    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedMode = themeVal === "system" ? (systemPrefersDark ? "dark" : "light") : themeVal;

    htmlRoot.setAttribute("data-theme", resolvedMode);
    if (metaColorScheme) {
      metaColorScheme.content = resolvedMode;
    }

    themeBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeVal === themeVal);
    });
  }

  // Initialize theme button click listeners
  themeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.themeVal);
    });
  });

  // Listen for OS system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentThemeSetting === "system") {
      applyTheme("system");
    }
  });

  // Apply on load
  applyTheme(currentThemeSetting);

  // ==========================================================================
  // WebSocket Agent Connection
  // ==========================================================================

  function connectWs() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    statusText.textContent = "Connecting...";
    statusDot.className = "status-dot";

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      statusText.textContent = "Ready";
      statusDot.className = "status-dot connected";
      appendLog("Connected to System One agent server", "system");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch (err) {
        console.error("WS Parse error:", err);
      }
    };

    ws.onclose = () => {
      statusText.textContent = "Disconnected";
      statusDot.className = "status-dot";
      appendLog("Disconnected from server. Retrying in 3s...", "warn");
      setTimeout(connectWs, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  // ==========================================================================
  // Message Dispatcher
  // ==========================================================================

  function handleWsMessage(msg) {
    switch (msg.type) {
      case "connected":
        break;

      case "status":
        updateStatus(msg.status);
        break;

      case "clear":
        resetExecutionState();
        break;

      case "page":
        if (msg.url) {
          urlDisplay.textContent = msg.url;
        }
        break;

      case "screenshot":
        if (msg.base64) {
          liveViewportImg.src = `data:image/jpeg;base64,${msg.base64}`;
          liveViewportImg.classList.remove("hidden");
          viewportPlaceholder.classList.add("hidden");
          recordingBadge.classList.remove("hidden");
        }
        break;

      case "step":
        addStepCard(msg.data);
        break;

      case "log":
        appendLog(msg.text);
        break;

      case "result":
        showResultCard(msg.data);
        break;

      case "error":
        appendLog(`ERROR: ${msg.error}`, "warn");
        alert(`Agent Error: ${msg.error}`);
        break;
    }
  }

  function updateStatus(status) {
    if (status === "running") {
      statusText.textContent = "Running...";
      statusDot.className = "status-dot running";
      startBtn.classList.add("hidden");
      stopBtn.classList.remove("hidden");
      startBtn.disabled = true;
      resultCard.classList.add("hidden");
    } else {
      statusText.textContent = status === "completed" ? "Completed" : "Ready";
      statusDot.className = "status-dot connected";
      startBtn.classList.remove("hidden");
      stopBtn.classList.add("hidden");
      startBtn.disabled = false;
      recordingBadge.classList.add("hidden");
    }
  }

  function resetExecutionState() {
    s1Count = 0;
    s2Count = 0;
    s1Stat.textContent = "S1: 0";
    s2Stat.textContent = "S2: 0";
    stepsTimeline.innerHTML = "";
    timelineEmpty.classList.add("hidden");
    resultCard.classList.add("hidden");
  }

  // ==========================================
  // Step & Telemetry Rendering
  // ==========================================

  function addStepCard(telemetry) {
    timelineEmpty.classList.add("hidden");

    if (telemetry.decisionPath === "SYSTEM_1_JEV") {
      s1Count++;
      s1Stat.textContent = `S1: ${s1Count}`;
    } else if (telemetry.decisionPath === "SYSTEM_2_GEMINI_FALLBACK") {
      s2Count++;
      s2Stat.textContent = `S2: ${s2Count}`;
    }

    const card = document.createElement("div");
    card.className = "step-item";

    let badgeClass = "s1";
    let badgeText = "⚡ System 1 (Jev Reflex)";

    if (telemetry.decisionPath === "SYSTEM_2_GEMINI_FALLBACK") {
      badgeClass = "s2";
      badgeText = "⚙ System 2 Fallback";
    } else if (telemetry.decisionPath === "TERMINATE_COMPLETE") {
      badgeClass = "complete";
      badgeText = "🏁 Goal Completed";
    } else if (telemetry.decisionPath === "TERMINATE_GUARDRAIL") {
      badgeClass = "guardrail";
      badgeText = "🛡 Destructive Blocked";
    }

    const confPercent = Math.round((telemetry.jevConfidence || 0) * 100);

    card.innerHTML = `
      <div class="step-header-row">
        <span class="step-number">Step ${telemetry.stepNumber}</span>
        <div class="step-badges">
          <span class="path-badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
      <div class="step-desc">${escapeHtml(telemetry.actionDescription)}</div>
      <div class="step-meta">
        <span>⏱ ${telemetry.latencyMs}ms</span>
        <span>🎯 Conf: ${confPercent}%</span>
        <span>🔗 ${escapeHtml(cleanUrl(telemetry.url))}</span>
      </div>
    `;

    stepsTimeline.appendChild(card);
    stepsTimeline.scrollTop = stepsTimeline.scrollHeight;
  }

  // ==========================================
  // Terminal Logs Rendering
  // ==========================================

  function appendLog(rawText, forceClass) {
    const text = (rawText || "").trim();
    if (!text) return;

    let lineClass = forceClass || "system";
    if (!forceClass) {
      if (text.includes("✔ [FAST-PATH]")) lineClass = "fastpath";
      else if (text.includes("⚙ [FALLBACK]")) lineClass = "fallback";
      else if (text.includes("🎉") || text.includes("Goal achieved") || text.includes("RUN COMPLETED")) lineClass = "success";
      else if (text.includes("⚠") || text.includes("Destructive")) lineClass = "warn";
    }

    const line = document.createElement("div");
    line.className = `console-line ${lineClass}`;
    line.textContent = `[${formatTime(new Date())}] ${text}`;

    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  // ==========================================
  // Result Callout Card
  // ==========================================

  function showResultCard(result) {
    resultCard.classList.remove("hidden");

    if (result.success) {
      resultCard.className = "notion-callout result-callout";
      resultIcon.textContent = "🎉";
      resultTitle.textContent = "Goal Completed Successfully";
    } else {
      resultCard.className = "notion-callout result-callout";
      resultIcon.textContent = "⚠";
      resultTitle.textContent = result.terminationReason || "Execution Terminated";
    }

    const totalSeconds = (result.totalLatencyMs / 1000).toFixed(1);
    const s1Ratio = result.totalSteps > 0 ? Math.round((result.system1StepCount / result.totalSteps) * 100) : 0;

    resultMeta.textContent = `${result.totalSteps} steps • ${totalSeconds}s total • ${s1Ratio}% System 1 Fast-Path (${result.system1StepCount} S1 / ${result.system2StepCount} S2)`;

    if (result.extractedData) {
      const dataStr = typeof result.extractedData === "object"
        ? JSON.stringify(result.extractedData, null, 2)
        : String(result.extractedData);
      resultBody.textContent = `Extracted Result:\n${dataStr}`;
      resultBody.classList.remove("hidden");
    } else {
      resultBody.textContent = `Status: ${result.terminationReason}`;
    }

    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ==========================================
  // Event Listeners
  // ==========================================

  agentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const goal = goalInput.value.trim();
    if (!goal || !ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: "start",
      goal,
      startUrl: urlInput.value.trim() || undefined,
      fallback: fallbackSelect.value,
      headless: headlessSelect.value === "true",
    };

    ws.send(JSON.stringify(payload));
  });

  stopBtn.addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop" }));
    }
  });

  clearLogsBtn.addEventListener("click", () => {
    consoleOutput.innerHTML = "";
  });

  presetTags.forEach((tag) => {
    tag.addEventListener("click", () => {
      const goal = tag.dataset.goal;
      const url = tag.dataset.url;
      if (goal) goalInput.value = goal;
      if (url) urlInput.value = url;
      agentForm.dispatchEvent(new Event("submit"));
    });
  });

  // ==========================================
  // Utilities
  // ==========================================

  function cleanUrl(rawUrl) {
    if (!rawUrl) return "";
    try {
      const u = new URL(rawUrl);
      return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + "..." : u.pathname);
    } catch {
      return rawUrl.slice(0, 30);
    }
  }

  function formatTime(date) {
    return date.toTimeString().split(" ")[0];
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Start WS connection
  connectWs();
})();
