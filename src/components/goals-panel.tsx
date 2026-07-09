import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";
import type { FinancialSnapshot } from "@/lib/snapshot";

interface Props {
  snapshot: FinancialSnapshot;
  onChange: () => void;
}

export function GoalsPanel({ snapshot, onChange }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
    currency: snapshot.base,
    target_date: "",
    priority: 3,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await supabase.from("goals").insert({
      user_id: user.id,
      name: form.name,
      target_amount: Number(form.target_amount) || 0,
      current_amount: Number(form.current_amount) || 0,
      currency: form.currency,
      target_date: form.target_date || null,
      priority: form.priority,
    });
    setOpen(false);
    setForm({ ...form, name: "", target_amount: "", current_amount: "", target_date: "" });
    onChange();
  };

  return (
    <section className="panel p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="label-mono mb-1">Future</p>
          <h3 className="font-display italic text-xl">What you're building toward.</h3>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface-2 border border-border hover:bg-elevated"
        >
          {open ? "Cancel" : "+ Goal"}
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="panel-inset p-4 mb-4 grid grid-cols-2 gap-3">
          <input
            required placeholder="Goal (e.g. Emergency 6mo)" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="col-span-2 bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          />
          <input
            required type="number" step="any" placeholder="Target" value={form.target_amount}
            onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
          />
          <input
            type="number" step="any" placeholder="Saved so far" value={form.current_amount}
            onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          >
            {ALL_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="date" value={form.target_date}
            onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          />
          <button className="col-span-2 py-2 rounded-md bg-foreground text-primary-foreground text-sm font-medium">
            Save goal
          </button>
        </form>
      )}

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
              <div key={g.id} className="panel-inset p-4">
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
