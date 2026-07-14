import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useEntityMutation } from "@/hooks/use-entity-mutation";
import { FormDialog } from "@/components/form-dialog";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";
import type { FinancialSnapshot, Goal } from "@/lib/snapshot";

interface Props {
  snapshot: FinancialSnapshot;
}

const empty = (base: string) => ({
  name: "",
  target_amount: "",
  current_amount: "",
  currency: base,
  target_date: "",
  priority: 3,
});

export function GoalsPanel({ snapshot }: Props) {
  const { user } = useAuth();
  const { create, update, remove } = useEntityMutation("goals", {
    create: "Goal added",
    update: "Goal updated",
    remove: "Goal removed",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState(empty(snapshot.base));

  const openCreate = () => {
    setEditing(null);
    setForm(empty(snapshot.base));
    setDialogOpen(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g);
    setForm({
      name: g.name,
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount),
      currency: g.currency,
      target_date: g.target_date ?? "",
      priority: g.priority,
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const target = Number(form.target_amount);
    const current = Number(form.current_amount) || 0;
    if (!Number.isFinite(target) || target <= 0) {
      const { toast } = await import("sonner");
      toast.error("Target must be a positive number.");
      return;
    }
    if (current < 0) {
      const { toast } = await import("sonner");
      toast.error("Saved amount cannot be negative.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      target_amount: target,
      current_amount: current,
      currency: form.currency,
      target_date: form.target_date || null,
      priority: form.priority,
    };

    if (editing) {
      await update.mutateAsync({ id: editing.id, values: payload });
    } else {
      await create.mutateAsync({ ...payload, user_id: user.id });
    }
    setDialogOpen(false);
  };

  return (
    <section className="panel p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="label-mono mb-1">Future</p>
          <h3 className="font-display italic text-xl">What you're building toward.</h3>
        </div>
        <button
          onClick={openCreate}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface-2 border border-border hover:bg-elevated"
        >
          + Goal
        </button>
      </header>

      {snapshot.goals.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Set at least one goal so the CFO can prioritize.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {snapshot.goals.map((g) => {
            const target = Number(g.target_amount);
            const current = Number(g.current_amount);
            const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
            return (
              <button
                key={g.id}
                onClick={() => openEdit(g)}
                className="panel-inset p-4 text-left hover:bg-elevated transition-colors"
              >
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-sm font-medium">{g.name}</p>
                  <p className="ticker text-[11px] text-muted-foreground">{pct.toFixed(0)}%</p>
                </div>
                <div className="h-1.5 rounded-full bg-canvas overflow-hidden mb-2">
                  <div className="h-full bg-blue" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span className="ticker">{fmtMoney(current, g.currency, { compact: true })}</span>
                  <span className="ticker">of {fmtMoney(target, g.currency, { compact: true })}</span>
                </div>
                {g.target_date && (
                  <p className="text-[10px] text-muted-foreground mt-1">by {g.target_date}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit goal" : "New goal"}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
      >
        <input
          required
          placeholder="Goal (e.g. Emergency 6mo)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            type="number"
            step="any"
            placeholder="Target"
            value={form.target_amount}
            onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
          />
          <input
            type="number"
            step="any"
            placeholder="Saved so far"
            value={form.current_amount}
            onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
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
            value={form.target_date}
            onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>
        {editing && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remove "${editing.name}"?`)) {
                remove.mutate(editing.id);
                setDialogOpen(false);
              }
            }}
            className="text-xs text-rose hover:underline"
          >
            Delete goal
          </button>
        )}
      </FormDialog>
    </section>
  );
}
