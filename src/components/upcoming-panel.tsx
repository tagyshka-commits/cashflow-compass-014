import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useEntityMutation } from "@/hooks/use-entity-mutation";
import { FormDialog } from "@/components/form-dialog";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";
import type { FinancialSnapshot, ExpectedIncome, CommittedExpense } from "@/lib/snapshot";

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

export function UpcomingPanel({ snapshot }: Props) {
  const { user } = useAuth();
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
      const { toast } = await import("sonner");
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
      if (editingId) {
        await incomes.update.mutateAsync({ id: editingId, values: payload });
      } else {
        await incomes.create.mutateAsync({ ...payload, user_id: user.id });
      }
    } else {
      const payload = {
        name: form.label.trim(),
        amount,
        currency: form.currency,
        due_date: date,
      };
      if (editingId) {
        await expenses.update.mutateAsync({ id: editingId, values: payload });
      } else {
        await expenses.create.mutateAsync({ ...payload, user_id: user.id });
      }
    }
    setDialogOpen(false);
  };

  const items = [
    ...snapshot.expected.map((e) => ({
      id: e.id,
      raw: e,
      kind: "income" as const,
      label: e.source,
      amount: Number(e.amount),
      currency: e.currency,
      date: e.expected_date,
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
      confidence: null,
    })),
  ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const submitting =
    incomes.create.isPending ||
    incomes.update.isPending ||
    expenses.create.isPending ||
    expenses.update.isPending;

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
        {items.map((i) => (
          <li key={i.kind + i.id} className="py-3 flex items-center justify-between gap-3">
            <button
              onClick={() =>
                i.kind === "income" ? openEditIncome(i.raw as ExpectedIncome) : openEditExpense(i.raw as CommittedExpense)
              }
              className="min-w-0 flex-1 text-left hover:opacity-80"
            >
              <p className="text-sm font-medium truncate">{i.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {i.date}
                {i.confidence != null && ` · ${i.confidence}`}
              </p>
            </button>
            <div className="text-right shrink-0">
              <p
                className={
                  "ticker text-sm font-semibold " +
                  (i.kind === "income" ? "text-green" : "text-rose")
                }
              >
                {i.kind === "income" ? "+" : "−"}
                {fmtMoney(i.amount, i.currency)}
              </p>
              <button
                onClick={() => {
                  if (!confirm(`Remove "${i.label}"?`)) return;
                  if (i.kind === "income") incomes.remove.mutate(i.id);
                  else expenses.remove.mutate(i.id);
                }}
                className="text-[10px] text-muted-foreground hover:text-rose"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          (editingId ? "Edit " : "Add ") + (kind === "income" ? "expected income" : "committed expense")
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
    </section>
  );
}
