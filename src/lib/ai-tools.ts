/**
 * Client-side executor for AI-proposed actions.
 * Every function takes the confirmed proposal + current user id and
 * runs the required Supabase writes. RLS scopes rows to the user.
 */
import { supabase } from "@/integrations/supabase/client";
import type { FinancialSnapshot, Account } from "@/lib/snapshot";

export type ProposalName =
  | "log_income"
  | "log_expense"
  | "transfer"
  | "lend_money"
  | "borrow_money"
  | "add_to_goal"
  | "move_to_protected";

export interface BatchItem {
  kind: "income" | "expense";
  amount: number;
  currency: string;
  category?: string;
  description?: string;
  account_name?: string;
}

export interface Proposal {
  name: ProposalName | string;
  args: Record<string, string | number | undefined | BatchItem[]>;
}

const findAccount = (accounts: Account[], name?: string) => {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return (
    accounts.find((a) => a.name.toLowerCase() === lower) ??
    accounts.find((a) => a.name.toLowerCase().includes(lower)) ??
    null
  );
};

async function adjustBalance(account: Account, delta: number) {
  const next = Number(account.balance) + delta;
  const { error } = await supabase
    .from("accounts")
    .update({ balance: next })
    .eq("id", account.id);
  if (error) throw error;
}

async function insertTx(userId: string, values: {
  account_id?: string | null;
  amount: number;
  currency: string;
  kind: "income" | "expense" | "transfer";
  category?: string | null;
  description?: string | null;
}) {
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    occurred_at: new Date().toISOString(),
    ...values,
  });
  if (error) throw error;
}

/** Human-readable preview of what a proposal will change. */
export function describeProposal(p: Proposal, snapshot: FinancialSnapshot): string[] {
  const a = p.args as Record<string, string | number | undefined | BatchItem[]>;
  const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  const amt = `${s(a.amount)} ${s(a.currency)}`;
  switch (p.name) {
    case "log_batch": {
      const items = (a.items as BatchItem[] | undefined) ?? [];
      const defaultAcc = a.account_name ? String(a.account_name) : undefined;
      const lines = items.map((it) => {
        const sign = it.kind === "income" ? "+" : "−";
        const acc = it.account_name ?? defaultAcc ?? "?";
        const cat = it.description ?? it.category ?? "";
        return `${sign} ${it.amount} ${it.currency} · ${acc}${cat ? ` · ${cat}` : ""}`;
      });
      return lines.length ? lines : ["(empty batch)"];
    }
    case "log_income":
      return [`Add ${amt} to ${s(a.account_name)}`, `Record income${a.category ? ` · ${s(a.category)}` : ""}`];
    case "log_expense":
      return [`Subtract ${amt} from ${s(a.account_name)}`, `Record expense${a.category ? ` · ${s(a.category)}` : ""}`];
    case "transfer":
      return [`${s(a.from_account)} − ${amt}`, `${s(a.to_account)} + ${amt}`];
    case "lend_money":
      return [`${s(a.from_account)} − ${amt}`, `Create debt: ${s(a.borrower)} owes you ${amt}`];
    case "borrow_money":
      return [`${s(a.to_account)} + ${amt}`, `Create debt: you owe ${s(a.lender)} ${amt}`];
    case "add_to_goal":
      return [`${s(a.from_account)} − ${amt}`, `Goal "${s(a.goal_name)}" +${amt}`];
    case "move_to_protected":
      return [`${s(a.from_account)} − ${amt}`, `Protected at ${s(a.storage_location)} +${amt}`];
    default:
      return [`Unknown action: ${p.name}`];
  }
  void snapshot;
}

/** Execute a confirmed proposal. Throws on error; caller shows toast. */
export async function executeProposal(
  p: Proposal,
  snapshot: FinancialSnapshot,
  userId: string,
): Promise<void> {
  const a = p.args;
  const amount = Number(a.amount);
  const currency = String(a.currency);

  switch (p.name) {
    case "log_batch": {
      const items = (a.items as BatchItem[] | undefined) ?? [];
      const defaultAcc = a.account_name ? String(a.account_name) : undefined;
      // Re-fetch fresh account balances mid-batch by mutating a working map,
      // so several items on the same account settle correctly.
      const working = new Map(snapshot.accounts.map((x) => [x.id, { ...x }]));
      for (const it of items) {
        const accName = it.account_name ?? defaultAcc;
        const found = findAccount([...working.values()], accName);
        if (!found) throw new Error(`Account "${accName ?? ""}" not found`);
        const live = working.get(found.id)!;
        const delta = it.kind === "income" ? Number(it.amount) : -Number(it.amount);
        const nextBal = Number(live.balance) + delta;
        const { error: uerr } = await supabase
          .from("accounts")
          .update({ balance: nextBal })
          .eq("id", live.id);
        if (uerr) throw uerr;
        live.balance = nextBal;
        await insertTx(userId, {
          account_id: live.id,
          amount: Number(it.amount),
          currency: String(it.currency),
          kind: it.kind,
          category: it.category ?? null,
          description: it.description ?? null,
        });
      }
      return;
    }
    case "log_income": {
      const acc = findAccount(snapshot.accounts, String(a.account_name));
      if (!acc) throw new Error(`Account "${a.account_name}" not found`);
      await adjustBalance(acc, amount);
      await insertTx(userId, {
        account_id: acc.id,
        amount,
        currency,
        kind: "income",
        category: a.category ? String(a.category) : null,
        description: a.description ? String(a.description) : null,
      });
      return;
    }
    case "log_expense": {
      const acc = findAccount(snapshot.accounts, String(a.account_name));
      if (!acc) throw new Error(`Account "${a.account_name}" not found`);
      await adjustBalance(acc, -amount);
      await insertTx(userId, {
        account_id: acc.id,
        amount,
        currency,
        kind: "expense",
        category: a.category ? String(a.category) : null,
        description: a.description ? String(a.description) : null,
      });
      return;
    }
    case "transfer": {
      const from = findAccount(snapshot.accounts, String(a.from_account));
      const to = findAccount(snapshot.accounts, String(a.to_account));
      if (!from) throw new Error(`Source "${a.from_account}" not found`);
      if (!to) throw new Error(`Target "${a.to_account}" not found`);
      await adjustBalance(from, -amount);
      await adjustBalance(to, amount);
      await insertTx(userId, {
        account_id: from.id,
        amount,
        currency,
        kind: "transfer",
        description: `Transfer to ${to.name}`,
      });
      return;
    }
    case "lend_money": {
      const from = findAccount(snapshot.accounts, String(a.from_account));
      if (!from) throw new Error(`Source "${a.from_account}" not found`);
      await adjustBalance(from, -amount);
      const { error } = await supabase.from("debts").insert({
        user_id: userId,
        name: String(a.borrower),
        direction: "owed_to_me",
        amount,
        currency,
        due_date: a.due_date ? String(a.due_date) : null,
      });
      if (error) throw error;
      return;
    }
    case "borrow_money": {
      const to = findAccount(snapshot.accounts, String(a.to_account));
      if (!to) throw new Error(`Target "${a.to_account}" not found`);
      await adjustBalance(to, amount);
      const { error } = await supabase.from("debts").insert({
        user_id: userId,
        name: String(a.lender),
        direction: "i_owe",
        amount,
        currency,
        due_date: a.due_date ? String(a.due_date) : null,
      });
      if (error) throw error;
      return;
    }
    case "add_to_goal": {
      const from = findAccount(snapshot.accounts, String(a.from_account));
      if (!from) throw new Error(`Source "${a.from_account}" not found`);
      const goalName = String(a.goal_name).toLowerCase();
      const goal = snapshot.goals.find((g) => g.name.toLowerCase().includes(goalName));
      if (!goal) throw new Error(`Goal "${a.goal_name}" not found`);
      await adjustBalance(from, -amount);
      const { error } = await supabase
        .from("goals")
        .update({ current_amount: Number(goal.current_amount) + amount })
        .eq("id", goal.id);
      if (error) throw error;
      return;
    }
    case "move_to_protected": {
      const from = findAccount(snapshot.accounts, String(a.from_account));
      if (!from) throw new Error(`Source "${a.from_account}" not found`);
      const location = String(a.storage_location);
      let target = snapshot.accounts.find(
        (x) => x.is_protected && (x.storage_location ?? "").toLowerCase() === location.toLowerCase(),
      );
      if (!target) {
        const { data, error } = await supabase
          .from("accounts")
          .insert({
            user_id: userId,
            name: `Protected · ${location}`,
            type: "cash",
            currency,
            balance: 0,
            is_protected: true,
            is_liquid: false,
            storage_location: location,
            notes: a.purpose ? `For: ${a.purpose}` : null,
          })
          .select()
          .single();
        if (error) throw error;
        target = data as Account;
      }
      await adjustBalance(from, -amount);
      await adjustBalance(target, amount);
      return;
    }
    default:
      throw new Error(`Unknown proposal: ${p.name}`);
  }
}
