/**
 * Aggregates all user financial data and computes reality-map numbers.
 * Called from dashboard + AI CFO chat as ground truth.
 */
import { supabase } from "@/integrations/supabase/client";
import { convert, DEFAULT_RATES_TO_USD, CRYPTO_CODES } from "@/lib/money";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Debt = Database["public"]["Tables"]["debts"]["Row"];
export type ExpectedIncome = Database["public"]["Tables"]["expected_incomes"]["Row"];
export type CommittedExpense = Database["public"]["Tables"]["committed_expenses"]["Row"];

export interface FinancialSnapshot {
  profile: Profile | null;
  base: string;
  rates: Record<string, number>;
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  debts: Debt[];
  expected: ExpectedIncome[];
  committed: CommittedExpense[];
  reality: {
    available: number;
    availableCrypto: number;
    expected: number;
    committed: number;
    emergency: number;
    netWorth: number;
    liabilities: number;
    assets: number;
  };
  health: {
    score: number;
    band: "green" | "yellow" | "red";
    reasons: string[];
  };
}

export async function fetchSnapshot(userId: string): Promise<FinancialSnapshot> {
  const [profileRes, accountsRes, txRes, goalsRes, debtsRes, expectedRes, committedRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("accounts").select("*").eq("user_id", userId).order("created_at"),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(200),
      supabase.from("goals").select("*").eq("user_id", userId).order("priority"),
      supabase.from("debts").select("*").eq("user_id", userId),
      supabase.from("expected_incomes").select("*").eq("user_id", userId).eq("received", false),
      supabase.from("committed_expenses").select("*").eq("user_id", userId),
    ]);

  const profile = profileRes.data ?? null;
  const base = profile?.base_currency ?? "USD";
  const rates = (profile?.personal_rates as Record<string, number> | null) ?? {};

  const accounts = accountsRes.data ?? [];
  const transactions = txRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const debts = debtsRes.data ?? [];
  const expected = expectedRes.data ?? [];
  const committed = committedRes.data ?? [];

  const toBase = (n: number, from: string) => convert(n, from, base, rates);

  // assets = sum of all positive account values (single source of truth).
  // available / availableCrypto / emergency are INFORMATIONAL SUBSETS of assets,
  // not independent buckets — they must never be re-added to netWorth.
  let assets = 0;
  let available = 0;
  let availableCrypto = 0;
  let emergency = 0;

  for (const a of accounts) {
    const raw = Number(a.balance);
    const value = toBase(raw, a.currency);

    // Card with negative balance = liability; tracked in cardDebt below, skip assets.
    if (a.type === "card" && raw < 0) continue;

    assets += value;

    if (a.is_emergency) {
      emergency += value;
    } else if (a.type === "crypto") {
      if (a.is_liquid) availableCrypto += value;
    } else if (a.is_liquid && (a.type === "cash" || a.type === "bank" || a.type === "card")) {
      available += value;
    }
  }

  const expectedTotal = expected.reduce((s, e) => s + toBase(Number(e.amount), e.currency), 0);
  const committedTotal = committed.reduce((s, c) => s + toBase(Number(c.amount), c.currency), 0);

  const liabilitiesFromDebts = debts
    .filter((d) => d.direction === "i_owe")
    .reduce((s, d) => s + toBase(Number(d.amount), d.currency), 0);
  const cardDebt = accounts
    .filter((a) => a.type === "card" && Number(a.balance) < 0)
    .reduce((s, a) => s + toBase(Math.abs(Number(a.balance)), a.currency), 0);

  const liabilities = liabilitiesFromDebts + cardDebt;
  const netWorth = assets - liabilities;

  // Health score (0-100)
  const reasons: string[] = [];
  let score = 100;
  // Debt ratio
  const totalLiquid = available + emergency + availableCrypto;
  const debtRatio = totalLiquid > 0 ? liabilities / totalLiquid : liabilities > 0 ? 2 : 0;
  if (debtRatio > 0.5) {
    score -= 25;
    reasons.push("Debt is high relative to liquid assets.");
  } else if (debtRatio > 0.25) {
    score -= 12;
    reasons.push("Debt ratio needs attention.");
  }
  // Emergency runway (months at avg committed)
  const monthlyBurn = committedTotal || 1;
  const runway = emergency / monthlyBurn;
  if (runway < 1) {
    score -= 30;
    reasons.push("Emergency reserve below one month of commitments.");
  } else if (runway < 3) {
    score -= 15;
    reasons.push("Emergency reserve under three months.");
  } else {
    reasons.push(`Emergency reserve covers ${runway.toFixed(1)} months.`);
  }
  // Crypto concentration
  const cryptoShare = netWorth > 0 ? availableCrypto / Math.max(netWorth, 1) : 0;
  if (cryptoShare > 0.6) {
    score -= 15;
    reasons.push("Crypto concentration is high — volatility risk.");
  }
  // No accounts penalty
  if (accounts.length === 0) {
    score = Math.min(score, 40);
    reasons.unshift("Add accounts to activate the full CFO analysis.");
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: "green" | "yellow" | "red" = score >= 75 ? "green" : score >= 50 ? "yellow" : "red";

  return {
    profile,
    base,
    rates: { ...DEFAULT_RATES_TO_USD, ...rates },
    accounts,
    transactions,
    goals,
    debts,
    expected,
    committed,
    reality: {
      available,
      availableCrypto,
      expected: expectedTotal,
      committed: committedTotal,
      emergency,
      netWorth,
      liabilities,
      assets,
    },
    health: { score, band, reasons },
  };
}

// Compact summary used to prompt the AI CFO.
export function snapshotForAI(s: FinancialSnapshot): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  return JSON.stringify({
    base_currency: s.base,
    reality: {
      available_cash: round(s.reality.available),
      available_crypto: round(s.reality.availableCrypto),
      expected_next_30d: round(s.reality.expected),
      committed_obligations: round(s.reality.committed),
      emergency_reserve: round(s.reality.emergency),
      net_worth: round(s.reality.netWorth),
      liabilities: round(s.reality.liabilities),
    },
    accounts: s.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: Number(a.balance),
      is_emergency: a.is_emergency,
      is_liquid: a.is_liquid,
      is_crypto: CRYPTO_CODES.includes(a.currency),
    })),
    goals: s.goals.map((g) => ({
      name: g.name,
      target: Number(g.target_amount),
      current: Number(g.current_amount),
      currency: g.currency,
      target_date: g.target_date,
      priority: g.priority,
    })),
    debts: s.debts.map((d) => ({
      name: d.name,
      direction: d.direction,
      amount: Number(d.amount),
      currency: d.currency,
      due_date: d.due_date,
      interest_rate: d.interest_rate,
    })),
    expected_incomes: s.expected.map((e) => ({
      source: e.source,
      amount: Number(e.amount),
      currency: e.currency,
      expected_date: e.expected_date,
      confidence: e.confidence,
    })),
    committed_expenses: s.committed.map((c) => ({
      name: c.name,
      amount: Number(c.amount),
      currency: c.currency,
      due_date: c.due_date,
      recurrence: c.recurrence,
    })),
    health_score: s.health.score,
    recent_transactions: s.transactions.slice(0, 40).map((t) => ({
      amount: Number(t.amount),
      currency: t.currency,
      kind: t.kind,
      category: t.category,
      description: t.description,
      at: t.occurred_at,
    })),
  });
}
