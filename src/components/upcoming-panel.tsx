import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEntityMutation } from "@/hooks/use-entity-mutation";
import { useInvalidateSnapshot } from "@/hooks/use-snapshot";
import { FormDialog } from "@/components/form-dialog";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";
import type { FinancialSnapshot, ExpectedIncome, CommittedExpense, Account } from "@/lib/snapshot";

interface Props {
  snapshot: FinancialSnapshot;
}

type Kind = "income" | "expense";
type Confidence = "guaranteed" | "likely" | "possible";

interface FormState {
  label: string;
  amount: string;
  currency: string;
  date: string;
  confidence: Confidence;
}

const empty = (base: string): FormState => ({
  label: "",
  amount: "",
  currency: base,
  date: "",
  confidence: "likely",
});

type ActionMode =
  | { kind: "receive"; income: ExpectedIncome }
  | { kind: "pay"; expense: CommittedExpense }
  | { kind: "delay"; row: { id: string; date: string | null; label: string; table: "expected_incomes" | "committed_expenses" } };

export function UpcomingPanel({ snapshot }: Props) {
  const { user } = useAuth();
  const invalidate = useInvalidateSnapshot();
  const incomes = useEntityMutation("expected_incomes", {
    create: "Expected income added",
    update: "Expected income updated",
    remove: "Removed",
  });
  const expenses = useEntityMutation("committed_expenses", {
    create: "Expense committed",
    update: "Expense updated",
    remove: "Removed",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("income");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty(snapshot.base));

  const [action, setAction] = useState<ActionMode | null>(null);
  const [actionAccountId, setActionAccountId] = useState("");
  const [actionDate, setActionDate] = useState("");

  const openCreate = (k: Kind) => {
    setKind(k);
    setEditingId(null);
    setForm(empty(snapshot.base));
    setDialogOpen(true);
  };

  const openEditIncome = (i: ExpectedIncome) => {
    setKind("income");
    setEditingId(i.id);
    setForm({
      label: i.source,
      amount: String(i.amount),
      currency: i.currency,
      date: i.expected_date ?? "",
      confidence: (i.confidence ?? "likely") as Confidence,
    });
    setDialogOpen(true);
  };

  const openEditExpense = (c: CommittedExpense) => {
    setKind("expense");
    setEditingId(c.id);
    setForm({
      label: c.name,
      amount: String(c.amount),
      currency: c.currency,
      date: c.due_date ?? "",
      confidence: "likely",
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be positive.");
      return;
    }
    const date = form.date || new Date().toISOString().slice(0, 10);

    if (kind === "income") {
      const payload = {
        source: form.label.trim(),
        amount,
        currency: form.currency,
        expected_date: date,
        confidence: form.confidence,
      };
      if (editingId) await incomes.update.mutateAsync({ id: editingId, values: payload });
      else await incomes.create.mutateAsync({ ...payload, user_id: user.id });
    } else {
      const payload = {
        name: form.label.trim(),
        amount,
        currency: form.currency,
        due_date: date,
      };
      if (editingId) await expenses.update.mutateAsync({ id: editingId, values: payload });
      else await expenses.create.mutateAsync({ ...payload, user_id: user.id });
    }
    setDialogOpen(false);
  };

  const today = new Date().toISOString().slice(0, 10);

  const items = [
    ...snapshot.expected.map((e) => ({
      id: e.id,
      raw: e,
      kind: "income" as const,
      label: e.source,
      amount: Number(e.amount),
      currency: e.currency,
      date: e.expected_date,
      status: e.status,
      confidence: e.confidence,
    })),
    ...snapshot.committed.map((c) => ({
      id: c.id,
      raw: c,
      kind: "expense" as const,
      label: c.name,
      amount: Number(c.amount),
      currency: c.currency,
      date: c.due_date,
      status: c.status,
      confidence: null,
    })),
  ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  // ------------ Lifecycle actions -----------
  const openReceive = (income: ExpectedIncome) => {
    setAction({ kind: "receive", income });
    const match = snapshot.accounts.find((a) => a.currency === income.currency && !a.is_protected);
    setActionAccountId(match?.id ?? "");
  };
  const openPay = (expense: CommittedExpense) => {
    setAction({ kind: "pay", expense });
    const match = snapshot.accounts.find((a) => a.currency === expense.currency && !a.is_protected);
    setActionAccountId(match?.id ?? "");
  };
  const openDelay = (item: (typeof items)[number]) => {
    setAction({
      kind: "delay",
      row: {
        id: item.id,
        date: item.date,
        label: item.label,
        table: item.kind === "income" ? "expected_incomes" : "committed_expenses",
      },
    });
    setActionDate(item.date ?? today);
  };

  const applyAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action || !user) return;
    try {
      if (action.kind === "receive") {
        const acc = snapshot.accounts.find((a) => a.id === actionAccountId);
        if (!acc) throw new Error("Pick an account");
        const amt = Number(action.income.amount);
        await supabase.from("accounts").update({ balance: Number(acc.balance) + amt }).eq("id", acc.id);
        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: acc.id,
          amount: amt,
          currency: action.income.currency,
          kind: "income",
          description: action.income.source,
          occurred_at: new Date().toISOString(),
        });
        await supabase
          .from("expected_incomes")
          .update({ status: "received", received_at: new Date().toISOString(), received: true })
          .eq("id", action.income.id);
        toast.success(`+${fmtMoney(amt, acc.currency)} → ${acc.name}`);
      } else if (action.kind === "pay") {
        const acc = snapshot.accounts.find((a) => a.id === actionAccountId);
        if (!acc) throw new Error("Pick an account");
        const amt = Number(action.expense.amount);
        await supabase.from("accounts").update({ balance: Number(acc.balance) - amt }).eq("id", acc.id);
        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: acc.id,
          amount: amt,
          currency: action.expense.currency,
          kind: "expense",
          description: action.expense.name,
          occurred_at: new Date().toISOString(),
        });
        await supabase
          .from("committed_expenses")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", action.expense.id);
        toast.success(`Paid ${fmtMoney(amt, acc.currency)} from ${acc.name}`);
      } else {
        if (!actionDate) throw new Error("Pick a new date");
        const orig = action.row.date;
        if (action.row.table === "expected_incomes") {
          await supabase
            .from("expected_incomes")
            .update({
              status: "delayed",
              expected_date: actionDate,
              ...(orig ? { original_expected_date: orig } : {}),
            })
            .eq("id", action.row.id);
        } else {
          await supabase
            .from("committed_expenses")
            .update({
              status: "delayed",
              due_date: actionDate,
              ...(orig ? { original_due_date: orig } : {}),
            })
            .eq("id", action.row.id);
        }
        toast.success("Rescheduled");
      }
      invalidate();
      setAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const convertIncomeToDebt = async (income: ExpectedIncome) => {
    if (!user) return;
    if (!confirm(`Convert "${income.source}" into money owed to you?`)) return;
    try {
      await supabase.from("debts").insert({
        user_id: user.id,
        name: income.source,
        direction: "owed_to_me",
        amount: income.amount,
        currency: income.currency,
        due_date: income.expected_date,
      });
      await supabase.from("expected_incomes").update({ status: "converted" }).eq("id", income.id);
      invalidate();
      toast.success("Converted to money-owed-to-me");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const cancelItem = async (item: (typeof items)[number]) => {
    if (!confirm(`Cancel "${item.label}"?`)) return;
    try {
      const table = item.kind === "income" ? "expected_incomes" : "committed_expenses";
      await supabase.from(table).update({ status: "cancelled" }).eq("id", item.id);
      invalidate();
      toast.success("Cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const submitting =
    incomes.create.isPending ||
    incomes.update.isPending ||
    expenses.create.isPending ||
    expenses.update.isPending;

  const eligibleAccounts = (currency: string): Account[] =>
    snapshot.accounts.filter((a) => a.currency === currency && !a.is_protected);

  return (
    <section className="panel p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="label-mono mb-1">Cash flow · 30d</p>
          <h3 className="font-display italic text-xl">What's coming.</h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => openCreate("income")}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-green/10 text-green hover:bg-green/15"
          >
            + In
          </button>
          <button
            onClick={() => openCreate("expense")}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-rose/10 text-rose hover:bg-rose/15"
          >
            + Out
          </button>
        </div>
      </header>

      <ul className="divide-y divide-border">
        {items.length === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">Nothing planned.</li>
        )}
        {items.map((i) => {
          const isDue = i.date != null && i.date <= today;
          const isOverdue = i.date != null && i.date < today;
          return (
            <li key={i.kind + i.id} className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() =>
                    i.kind === "income"
                      ? openEditIncome(i.raw as ExpectedIncome)
                      : openEditExpense(i.raw as CommittedExpense)
                  }
                  className="min-w-0 flex-1 text-left hover:opacity-80"
                >
                  <p className="text-sm font-medium truncate">{i.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {i.date}
                    {i.confidence != null && ` · ${i.confidence}`}
                    {i.status === "delayed" && " · delayed"}
                    {isOverdue && i.status === "pending" && (
                      <span className="text-amber ticker"> · overdue</span>
                    )}
                    {isDue && !isOverdue && i.status === "pending" && (
                      <span className="text-blue ticker"> · due today</span>
                    )}
                  </p>
                </button>
                <p
                  className={
                    "ticker text-sm font-semibold shrink-0 " +
                    (i.kind === "income" ? "text-green" : "text-rose")
                  }
                >
                  {i.kind === "income" ? "+" : "−"}
                  {fmtMoney(i.amount, i.currency)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px]">
                {i.kind === "income" ? (
                  <>
                    <button
                      onClick={() => openReceive(i.raw as ExpectedIncome)}
                      className="px-2 py-1 rounded bg-green/10 text-green hover:bg-green/20"
                    >
                      Received
                    </button>
                    <button
                      onClick={() => openDelay(i)}
                      className="px-2 py-1 rounded bg-amber/10 text-amber hover:bg-amber/20"
                    >
                      Delay
                    </button>
                    <button
                      onClick={() => convertIncomeToDebt(i.raw as ExpectedIncome)}
                      className="px-2 py-1 rounded bg-blue/10 text-blue hover:bg-blue/20"
                    >
                      → Debt
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openPay(i.raw as CommittedExpense)}
                      className="px-2 py-1 rounded bg-rose/10 text-rose hover:bg-rose/20"
                    >
                      Paid
                    </button>
                    <button
                      onClick={() => openDelay(i)}
                      className="px-2 py-1 rounded bg-amber/10 text-amber hover:bg-amber/20"
                    >
                      Delay
                    </button>
                  </>
                )}
                <button
                  onClick={() => cancelItem(i)}
                  className="px-2 py-1 rounded bg-surface-2 text-muted-foreground hover:bg-elevated"
                >
                  Cancel
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Create/edit dialog */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          (editingId ? "Edit " : "Add ") +
          (kind === "income" ? "expected income" : "committed expense")
        }
        onSubmit={submit}
        submitting={submitting}
      >
        <input
          required
          placeholder={kind === "income" ? "Source (e.g. Client X)" : "Name (e.g. Rent)"}
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            required
            type="number"
            step="any"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          >
            {ALL_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>
        {kind === "income" && (
          <div className="flex gap-1">
            {(["guaranteed", "likely", "possible"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, confidence: c })}
                className={
                  "flex-1 text-[11px] px-2 py-1.5 rounded-md border capitalize " +
                  (form.confidence === c
                    ? "bg-foreground text-primary-foreground border-foreground"
                    : "bg-canvas border-border text-muted-foreground")
                }
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </FormDialog>

      {/* Lifecycle action dialog */}
      <FormDialog
        open={action !== null}
        onOpenChange={(o) => !o && setAction(null)}
        title={
          action?.kind === "receive"
            ? `Mark "${action.income.source}" received`
            : action?.kind === "pay"
              ? `Mark "${action.expense.name}" paid`
              : action?.kind === "delay"
                ? `Delay "${action.row.label}"`
                : ""
        }
        onSubmit={applyAction}
        submitLabel={action?.kind === "delay" ? "Reschedule" : "Confirm"}
      >
        {(action?.kind === "receive" || action?.kind === "pay") && (
          <>
            <p className="text-xs text-muted-foreground">
              {action.kind === "receive" ? "Deposit into" : "Pay from"} which account?
            </p>
            <select
              value={actionAccountId}
              onChange={(e) => setActionAccountId(e.target.value)}
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm"
              required
            >
              <option value="">— pick account —</option>
              {eligibleAccounts(
                action.kind === "receive" ? action.income.currency : action.expense.currency,
              ).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {fmtMoney(Number(a.balance), a.currency)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Only same-currency, non-protected accounts are listed.
            </p>
          </>
        )}
        {action?.kind === "delay" && (
          <>
            <p className="text-xs text-muted-foreground">New expected date</p>
            <input
              type="date"
              value={actionDate}
              onChange={(e) => setActionDate(e.target.value)}
              className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm"
              required
            />
          </>
        )}
      </FormDialog>
    </section>
  );
}
