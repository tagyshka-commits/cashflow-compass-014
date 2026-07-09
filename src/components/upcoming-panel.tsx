import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";
import type { FinancialSnapshot } from "@/lib/snapshot";

interface Props {
  snapshot: FinancialSnapshot;
  onChange: () => void;
}

type Mode = "income" | "expense" | null;

export function UpcomingPanel({ snapshot, onChange }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState({
    label: "",
    amount: "",
    currency: snapshot.base,
    date: "",
    confidence: 80,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mode) return;
    if (mode === "income") {
      await supabase.from("expected_incomes").insert({
        user_id: user.id,
        source: form.label,
        amount: Number(form.amount) || 0,
        currency: form.currency,
        expected_date: form.date || new Date().toISOString().slice(0, 10),
        confidence: form.confidence,
      });
    } else {
      await supabase.from("committed_expenses").insert({
        user_id: user.id,
        name: form.label,
        amount: Number(form.amount) || 0,
        currency: form.currency,
        due_date: form.date || new Date().toISOString().slice(0, 10),
      });
    }
    setMode(null);
    setForm({ ...form, label: "", amount: "", date: "" });
    onChange();
  };

  const items = [
    ...snapshot.expected.map((e) => ({
      id: e.id,
      kind: "income" as const,
      label: e.source,
      amount: Number(e.amount),
      currency: e.currency,
      date: e.expected_date,
      confidence: e.confidence,
    })),
    ...snapshot.committed.map((c) => ({
      id: c.id,
      kind: "expense" as const,
      label: c.name,
      amount: Number(c.amount),
      currency: c.currency,
      date: c.due_date,
      confidence: null,
    })),
  ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const remove = async (kind: "income" | "expense", id: string) => {
    const table = kind === "income" ? "expected_incomes" : "committed_expenses";
    await supabase.from(table).delete().eq("id", id);
    onChange();
  };

  return (
    <section className="panel p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="label-mono mb-1">Cash flow · 30d</p>
          <h3 className="font-display italic text-xl">What's coming.</h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode(mode === "income" ? null : "income")}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-green/10 text-green hover:bg-green/15"
          >
            + In
          </button>
          <button
            onClick={() => setMode(mode === "expense" ? null : "expense")}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-rose/10 text-rose hover:bg-rose/15"
          >
            + Out
          </button>
        </div>
      </header>

      {mode && (
        <form onSubmit={submit} className="panel-inset p-4 mb-4 space-y-3">
          <input
            required
            placeholder={mode === "income" ? "Source (e.g. Client X)" : "Name (e.g. Rent)"}
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
              {ALL_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          {mode === "income" && (
            <label className="block text-xs text-muted-foreground">
              Confidence: {form.confidence}%
              <input
                type="range" min={0} max={100} value={form.confidence}
                onChange={(e) => setForm({ ...form, confidence: Number(e.target.value) })}
                className="w-full mt-1"
              />
            </label>
          )}
          <button className="w-full py-2 rounded-md bg-foreground text-primary-foreground text-sm font-medium">
            Add {mode}
          </button>
        </form>
      )}

      <ul className="divide-y divide-border">
        {items.length === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">Nothing planned.</li>
        )}
        {items.map((i) => (
          <li key={i.kind + i.id} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{i.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {i.date}
                {i.confidence != null && ` · ${i.confidence}% confidence`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={"ticker text-sm font-semibold " + (i.kind === "income" ? "text-green" : "text-rose")}>
                {i.kind === "income" ? "+" : "−"}{fmtMoney(i.amount, i.currency)}
              </p>
              <button onClick={() => remove(i.kind, i.id)} className="text-[10px] text-muted-foreground hover:text-rose">Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
