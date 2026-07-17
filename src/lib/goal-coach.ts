/**
 * Pure logic for proactive goal coaching.
 * Given a goal, computes required daily/weekly/monthly savings,
 * status (ahead / on-track / needs-attention / at-risk / done),
 * and a human tier label from the numeric priority.
 */
import type { Goal } from "@/lib/snapshot";

export type GoalStatus = "done" | "ahead" | "on_track" | "needs_attention" | "at_risk";
export type GoalTier = "Critical" | "Important" | "Lifestyle";

export interface GoalCoach {
  status: GoalStatus;
  tier: GoalTier;
  progressPct: number;
  remaining: number;
  daysLeft: number | null;
  required: {
    daily: number | null;
    weekly: number | null;
    monthly: number | null;
  };
  /** Expected progress ratio (0..1) at "today" given a linear plan. */
  expectedPct: number | null;
  /** Short one-line coach note. */
  headline: string;
}

const tierFromPriority = (p: number | null | undefined): GoalTier => {
  if (p == null) return "Lifestyle";
  if (p <= 1) return "Critical";
  if (p === 2) return "Important";
  return "Lifestyle";
};

const daysBetween = (from: Date, to: Date): number =>
  Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));

export function coachGoal(g: Goal, now: Date = new Date()): GoalCoach {
  const target = Number(g.target_amount);
  const current = Math.max(0, Number(g.current_amount));
  const remaining = Math.max(0, target - current);
  const progressPct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const tier = tierFromPriority(g.priority);

  let daysLeft: number | null = null;
  let daily: number | null = null;
  let weekly: number | null = null;
  let monthly: number | null = null;
  let expectedPct: number | null = null;
  let status: GoalStatus;

  if (target > 0 && current >= target) {
    return {
      status: "done",
      tier,
      progressPct: 100,
      remaining: 0,
      daysLeft: null,
      required: { daily: null, weekly: null, monthly: null },
      expectedPct: 1,
      headline: "Goal reached.",
    };
  }

  if (g.target_date) {
    const dueDate = new Date(g.target_date);
    daysLeft = daysBetween(now, dueDate);
    if (daysLeft > 0) {
      daily = remaining / daysLeft;
      weekly = daily * 7;
      monthly = daily * 30;
    }
    // Expected linear progress: how much of the total window has elapsed.
    const createdAt = g.created_at ? new Date(g.created_at) : now;
    const totalWindow = Math.max(1, daysBetween(createdAt, dueDate));
    const elapsed = Math.max(0, daysBetween(createdAt, now));
    expectedPct = Math.min(1, elapsed / totalWindow);
  }

  // Status heuristic.
  if (daysLeft != null && daysLeft <= 0 && remaining > 0) {
    status = "at_risk";
  } else if (expectedPct != null) {
    const actual = target > 0 ? current / target : 0;
    const diff = actual - expectedPct;
    if (diff >= 0.05) status = "ahead";
    else if (diff >= -0.05) status = "on_track";
    else if (diff >= -0.15) status = "needs_attention";
    else status = "at_risk";
  } else {
    status = current > 0 ? "on_track" : "needs_attention";
  }

  const headline = ((): string => {
    if (status === "at_risk" && daysLeft != null && daysLeft <= 0)
      return "Deadline passed. Reset or extend.";
    if (daily != null && daysLeft != null && daysLeft > 0) {
      const d = daily >= 1 ? daily.toFixed(0) : daily.toFixed(2);
      const w = weekly! >= 1 ? weekly!.toFixed(0) : weekly!.toFixed(2);
      return `Save ${d}/day · ${w}/week for ${daysLeft} days.`;
    }
    return status === "ahead" ? "You're ahead of plan." : "Set a target date to unlock the plan.";
  })();

  return {
    status,
    tier,
    progressPct,
    remaining,
    daysLeft,
    required: { daily, weekly, monthly },
    expectedPct,
    headline,
  };
}

export const STATUS_LABEL: Record<GoalStatus, string> = {
  done: "Done",
  ahead: "Ahead",
  on_track: "On track",
  needs_attention: "Needs attention",
  at_risk: "At risk",
};

export const STATUS_COLOR: Record<GoalStatus, string> = {
  done: "text-green",
  ahead: "text-green",
  on_track: "text-blue",
  needs_attention: "text-amber",
  at_risk: "text-rose",
};

export const TIER_COLOR: Record<GoalTier, string> = {
  Critical: "text-rose",
  Important: "text-amber",
  Lifestyle: "text-muted-foreground",
};
