import React from "react";
import { Zap, Cpu, CheckCircle2, AlertTriangle } from "lucide-react";
import type { StepDecisionPath } from "@/types/agent";

const BADGES: Record<
  StepDecisionPath,
  { label: string; icon: typeof Zap; bg: string; text: string; filled?: boolean }
> = {
  SYSTEM_1_JEV: {
    label: "System 1 (Jev Reflex)",
    icon: Zap,
    bg: "var(--tag-green-bg)",
    text: "var(--tag-green-text)",
    filled: true,
  },
  SYSTEM_2_GEMINI_FALLBACK: {
    label: "System 2 Fallback",
    icon: Cpu,
    bg: "var(--tag-blue-bg)",
    text: "var(--tag-blue-text)",
  },
  TERMINATE_COMPLETE: {
    label: "Goal Complete",
    icon: CheckCircle2,
    bg: "var(--tag-purple-bg)",
    text: "var(--tag-purple-text)",
  },
  TERMINATE_GUARDRAIL: {
    label: "Guardrail Blocked",
    icon: AlertTriangle,
    bg: "var(--tag-red-bg)",
    text: "var(--tag-red-text)",
  },
};

/** Single source of truth for how a decision path is labelled and coloured. */
export function DecisionBadge({
  path,
  size = "sm",
}: {
  path: StepDecisionPath;
  size?: "sm" | "md";
}) {
  const badge = BADGES[path];
  if (!badge) return null;

  const Icon = badge.icon;
  const iconSize = size === "md" ? "w-3 h-3" : "w-2.5 h-2.5";

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded shrink-0 ${
        size === "md" ? "text-[11px]" : "text-[10px]"
      }`}
      style={{ backgroundColor: badge.bg, color: badge.text }}
    >
      <Icon className={`${iconSize} ${badge.filled ? "fill-current" : ""}`} />
      <span>{badge.label}</span>
    </span>
  );
}
