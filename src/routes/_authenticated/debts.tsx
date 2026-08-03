import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSnapshot } from "@/hooks/use-snapshot";
import { useEntityMutation } from "@/hooks/use-entity-mutation";
import { FormDialog } from "@/components/form-dialog";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";
import type { Debt } from "@/lib/snapshot";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({
    meta: [
      { title: "Debts — Equilibrium" },
      { name: "description", content: "Track what you owe and what is owed to you, with running balances, repayments and per-debtor status across currencies." },
      { property: "og:title", content: "Debts — Equilibrium" },
      { property: "og:description", content: "Track what you owe and what is owed to you, with running balances, repayments and per-debtor status across currencies." },
      { property: "og:url", content: "https://cashflow-compass-014.lovable.app/debts" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://cashflow-compass-014.lovable.app/debts" }],
  }),
  component: DebtsPage,
});

type Direction = "i_owe" | "owed_to_me";

const empty = () => ({
  name: "",
  direction: "i_owe" as Direction,
  amount: "",
  currency: "USD",
  due_date: "",
  interest_rate: "",
});

function DebtsPage() {
  const { snapshot, loading } = useSnapshot();
  const { user } = useAuth();
  const { create, update, remove } = useEntityMutation("debts", {
    create: "Debt added",
    update: "Debt updated",
    remove: "Debt removed",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [form, setForm] = useState(empty());

  if (loading || !snapshot) return <div className="py-24 text-center label-mono">Loading</div>;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty(), currency: snapshot.base });
    setDialogOpen(true);
  };

  const openEdit = (d: Debt) => {
    setEditing(d);
    setForm({
      name: d.name,
      direction: d.direction as Direction,
      amount: String(d.amount),
      currency: d.currency,
      due_date: d.due_date ?? "",
      interest_rate: d.interest_rate ? String(d.interest_rate) : "",
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
    const payload = {
      name: form.name.trim(),
      direction: form.direction,
      amount,
      currency: form.currency,
      due_date: form.due_date || null,
      interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
    };
    if (editing) {
      await update.mutateAsync({ id: editing.id, values: payload });
    } else {
      await create.mutateAsync({ ...payload, user_id: user.id });
    }
    setDialogOpen(false);
  };

  const iOwe = snapshot.debts.filter((d) => d.direction === "i_owe");
  const owedToMe = snapshot.debts.filter((d) => d.direction === "owed_to_me");

  return (
    <div className="max-w-4xl mx-auto animate-fade-up space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="label-mono mb-2">Ledger</p>
          <h1 className="font-display italic text-4xl">Debts & IOUs.</h1>
        </div>
        <button
          onClick={openCreate}
          className="text-xs font-medium px-4 py-2 rounded-full bg-foreground text-primary-foreground"
        >
          + Add
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { title: "I owe", list: iOwe, tone: "text-rose" },
          { title: "Owed to me", list: owedToMe, tone: "text-green" },
        ].map((col) => (
          <section key={col.title} className="panel p-6">
            <h2 className="font-display italic text-xl mb-3">{col.title}</h2>
            {col.list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {col.list.map((d) => (
                  <li key={d.id} className="py-3 flex justify-between gap-3">
                    <button
                      onClick={() => openEdit(d)}
                      className="min-w-0 flex-1 text-left hover:opacity-80"
                    >
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.due_date && `due ${d.due_date}`}
                        {d.interest_rate ? ` · ${d.interest_rate}%` : ""}
                      </p>
                    </button>
                    <div className="text-right shrink-0">
                      <p className={"ticker text-sm font-semibold " + col.tone}>
                        {fmtMoney(Number(d.amount), d.currency)}
                      </p>
                      <div className="flex gap-2 justify-end mt-0.5">
                        <button
                          onClick={() => openEdit(d)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove "${d.name}"?`)) remove.mutate(d.id);
                          }}
                          className="text-[10px] text-muted-foreground hover:text-rose"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit debt" : "Add debt"}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
      >
        <input
          required
          placeholder="Name (person or lender)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm"
        />
        <select
          value={form.direction}
          onChange={(e) => setForm({ ...form, direction: e.target.value as Direction })}
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm"
        >
          <option value="i_owe">I owe</option>
          <option value="owed_to_me">Owed to me</option>
        </select>
        <div className="grid grid-cols-2 gap-3">
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
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="any"
            placeholder="Interest %"
            value={form.interest_rate}
            onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
          />
        </div>
      </FormDialog>
    </div>
  );
}
