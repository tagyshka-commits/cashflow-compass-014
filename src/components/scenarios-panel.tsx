import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useEntityMutation } from "@/hooks/use-entity-mutation";
import { FormDialog } from "@/components/form-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateSnapshot } from "@/hooks/use-snapshot";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";
import { toast } from "sonner";
import type { FinancialSnapshot, Scenario } from "@/lib/snapshot";

interface Props {
  snapshot: FinancialSnapshot;
}

const empty = (base: string) => ({
  kind: "income" as "income" | "expense" | "event",
  title: "",
  amount: "",
  currency: base,
  likelihood: 50,
  expected_date: "",
  notes: "",
});

const KIND_COLOR: Record<string, string> = {
  income: "text-green",
  expense: "text-rose",
  event: "text-amber",
};

export function ScenariosPanel({ snapshot }: Props) {
  const { user } = useAuth();
  const invalidate = useInvalidateSnapshot();
  const { create } = useEntityMutation("scenarios", {
    create: "Scenario noted",
    update: "Scenario updated",
    remove: "Scenario removed",
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty(snapshot.base));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = form.amount ? Number(form.amount) : null;
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
      toast.error("Amount must be a non-negative number.");
      return;
    }
    await create.mutateAsync({
      user_id: user.id,
      kind: form.kind,
      title: form.title.trim(),
      amount,
      currency: amount != null ? form.currency : null,
      likelihood: form.likelihood,
      expected_date: form.expected_date || null,
      notes: form.notes.trim() || null,
    });
    setOpen(false);
    setForm(empty(snapshot.base));
  };

  const dismiss = async (s: Scenario) => {
    const { error } = await supabase
      .from("scenarios")
      .update({ status: "dismissed" })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    invalidate();
    toast.success("Scenario dismissed");
  };

  return (
    <section className="panel p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="label-mono mb-1">Possibilities</p>
          <h3 className="font-display italic text-xl">Not yet real — but on the radar.</h3>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface-2 border border-border hover:bg-elevated"
        >
          + Scenario
        </button>
      </header>

      {snapshot.scenarios.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing pending. Say "I might get a bonus in December" and the CFO will record it here.
        </p>
      ) : (
        <ul className="space-y-2">
          {snapshot.scenarios.map((s) => (
            <li key={s.id} className="panel-inset p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className={`text-[10px] ticker uppercase ${KIND_COLOR[s.kind] ?? ""}`}>
                    {s.kind}
                  </p>
                  <p className="text-sm truncate">{s.title}</p>
                </div>
                <div className="flex items-baseline gap-3 text-[11px] text-muted-foreground mt-0.5">
                  {s.amount != null && s.currency && (
                    <span className="ticker text-foreground/80">
                      {fmtMoney(Number(s.amount), s.currency, { compact: true })}
                    </span>
                  )}
                  <span className="ticker">{s.likelihood}% likely</span>
                  {s.expected_date && <span className="ticker">by {s.expected_date}</span>}
                </div>
                {s.notes && <p className="text-[11px] text-muted-foreground mt-1">{s.notes}</p>}
              </div>
              <button
                onClick={() => dismiss(s)}
                className="text-[11px] px-2 py-1 rounded-md bg-surface-2 border border-border hover:bg-elevated shrink-0"
                title="Remove from radar"
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Add scenario"
        onSubmit={submit}
        submitting={create.isPending}
      >
        <p className="text-[11px] text-muted-foreground -mt-1">
          A possibility, not a fact. Nothing here changes balances until you confirm it.
        </p>
        <input
          required
          placeholder='e.g. "Maybe borrow 500 from Mom"'
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          >
            <option value="income">Possible income</option>
            <option value="expense">Possible expense</option>
            <option value="event">Possible event</option>
          </select>
          <input
            type="date"
            value={form.expected_date}
            onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="any"
            placeholder="Amount (optional)"
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
        </div>
        <label className="block text-[11px] text-muted-foreground">
          Likelihood: <span className="ticker text-foreground">{form.likelihood}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.likelihood}
            onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })}
            className="w-full mt-1"
          />
        </label>
        <textarea
          rows={2}
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm resize-none"
        />
      </FormDialog>
    </section>
  );
}
