import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useEntityMutation } from "@/hooks/use-entity-mutation";
import { FormDialog } from "@/components/form-dialog";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";
import type { FinancialSnapshot, Goal } from "@/lib/snapshot";
import {
  coachGoal,
  STATUS_LABEL,
  STATUS_COLOR,
  TIER_COLOR,
  type GoalCoach,
} from "@/lib/goal-coach";

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

  // Quick-add contribution flow
  const [contribOpen, setContribOpen] = useState(false);
  const [contribGoal, setContribGoal] = useState<Goal | null>(null);
  const [contribAmount, setContribAmount] = useState("");

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

  const openContrib = (g: Goal, prefill?: number) => {
    setContribGoal(g);
    setContribAmount(prefill != null ? prefill.toFixed(2) : "");
    setContribOpen(true);
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

  const submitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    const amt = Number(contribAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      const { toast } = await import("sonner");
      toast.error("Enter a positive amount.");
      return;
    }
    const next = Math.max(0, Number(contribGoal.current_amount) + amt);
    await update.mutateAsync({ id: contribGoal.id, values: { current_amount: next } });
    setContribOpen(false);
  };

  const renderBar = (c: GoalCoach) => {
    const expected = c.expectedPct != null ? c.expectedPct * 100 : null;
    return (
      <div className="relative h-1.5 rounded-full bg-canvas overflow-hidden mb-2">
        <div className="h-full bg-blue" style={{ width: `${c.progressPct}%` }} />
        {expected != null && (
          <span
            className="absolute top-0 h-full w-px bg-foreground/40"
            style={{ left: `${Math.min(100, Math.max(0, expected))}%` }}
            aria-label="Expected progress"
          />
        )}
      </div>
    );
  };

  return (
    <section className="panel p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="label-mono mb-1">Future</p>
          <h2 className="font-display italic text-xl">What you're building toward.</h2>
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
            const c = coachGoal(g);
            const target = Number(g.target_amount);
            const current = Number(g.current_amount);
            return (
              <div key={g.id} className="panel-inset p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => openEdit(g)}
                    className="text-left flex-1 min-w-0 hover:opacity-80"
                  >
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    <p className={`text-[10px] ticker ${TIER_COLOR[c.tier]}`}>
                      {c.tier.toUpperCase()}
                    </p>
                  </button>
                  <div className="text-right shrink-0">
                    <p className="ticker text-[11px] text-muted-foreground">
                      {c.progressPct.toFixed(0)}%
                    </p>
                    <p className={`text-[10px] ticker ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </p>
                  </div>
                </div>

                {renderBar(c)}

                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span className="ticker">{fmtMoney(current, g.currency, { compact: true })}</span>
                  <span className="ticker">
                    of {fmtMoney(target, g.currency, { compact: true })}
                  </span>
                </div>

                <p className="text-[11px] text-foreground/80 leading-snug">{c.headline}</p>

                {c.required.daily != null && c.required.weekly != null && c.required.monthly != null && (
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    {(["daily", "weekly", "monthly"] as const).map((k) => {
                      const v = c.required[k]!;
                      return (
                        <div key={k} className="bg-canvas rounded px-2 py-1">
                          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                            {k}
                          </p>
                          <p className="ticker text-[11px]">
                            {fmtMoney(v, g.currency, { compact: true })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-1 pt-1">
                  <button
                    onClick={() => openContrib(g)}
                    disabled={c.status === "done"}
                    className="flex-1 text-[11px] px-2 py-1.5 rounded-md bg-foreground text-primary-foreground disabled:opacity-40"
                  >
                    + Contribute
                  </button>
                  {c.required.daily != null && (
                    <button
                      onClick={() => openContrib(g, c.required.daily!)}
                      className="text-[11px] px-2 py-1.5 rounded-md bg-surface-2 border border-border"
                      title="Add today's required amount"
                    >
                      + Today
                    </button>
                  )}
                </div>
              </div>
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
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm col-span-2"
          >
            <option value={1}>Critical — safety, emergencies</option>
            <option value={2}>Important — education, health</option>
            <option value={3}>Lifestyle — travel, upgrades</option>
          </select>
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

      <FormDialog
        open={contribOpen}
        onOpenChange={setContribOpen}
        title={contribGoal ? `Contribute to ${contribGoal.name}` : "Contribute"}
        onSubmit={submitContribution}
        submitting={update.isPending}
      >
        <input
          autoFocus
          required
          type="number"
          step="any"
          placeholder="Amount"
          value={contribAmount}
          onChange={(e) => setContribAmount(e.target.value)}
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
        />
        <p className="text-[11px] text-muted-foreground">
          Adds to the goal's saved amount. Account balances aren't touched here — use the CFO chat
          ("+50 to {contribGoal?.name} from Cash") to move real money.
        </p>
      </FormDialog>
    </section>
  );
}
