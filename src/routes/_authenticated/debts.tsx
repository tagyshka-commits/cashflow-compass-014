import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSnapshot } from "@/hooks/use-snapshot";
import { fmtMoney, ALL_CURRENCIES } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/debts")({
  component: DebtsPage,
});

function DebtsPage() {
  const { snapshot, loading, refresh } = useSnapshot();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    direction: "i_owe" as "i_owe" | "owed_to_me",
    amount: "",
    currency: "USD",
    due_date: "",
    interest_rate: "",
  });

  if (loading || !snapshot) return <div className="py-24 text-center label-mono">Loading</div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await supabase.from("debts").insert({
      user_id: user.id,
      name: form.name,
      direction: form.direction,
      amount: Number(form.amount) || 0,
      currency: form.currency,
      due_date: form.due_date || null,
      interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
    });
    setOpen(false);
    setForm({ ...form, name: "", amount: "", due_date: "", interest_rate: "" });
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("debts").delete().eq("id", id);
    refresh();
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
          onClick={() => setOpen(!open)}
          className="text-xs font-medium px-4 py-2 rounded-full bg-foreground text-primary-foreground"
        >
          {open ? "Cancel" : "+ Add"}
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="panel p-6 grid grid-cols-2 gap-3">
          <input
            required placeholder="Name (person or lender)" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="col-span-2 bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          />
          <select
            value={form.direction}
            onChange={(e) => setForm({ ...form, direction: e.target.value as "i_owe" | "owed_to_me" })}
            className="col-span-2 bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          >
            <option value="i_owe">I owe</option>
            <option value="owed_to_me">Owed to me</option>
          </select>
          <input
            required type="number" step="any" placeholder="Amount" value={form.amount}
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
            type="date" value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          />
          <input
            type="number" step="any" placeholder="Interest %" value={form.interest_rate}
            onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
          />
          <button className="col-span-2 py-2 rounded-md bg-foreground text-primary-foreground text-sm font-medium">
            Save
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { title: "I owe", list: iOwe, tone: "text-rose" },
          { title: "Owed to me", list: owedToMe, tone: "text-green" },
        ].map((col) => (
          <section key={col.title} className="panel p-6">
            <h3 className="font-display italic text-xl mb-3">{col.title}</h3>
            {col.list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {col.list.map((d) => (
                  <li key={d.id} className="py-3 flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.due_date && `due ${d.due_date}`}
                        {d.interest_rate ? ` · ${d.interest_rate}%` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={"ticker text-sm font-semibold " + col.tone}>
                        {fmtMoney(Number(d.amount), d.currency)}
                      </p>
                      <button onClick={() => remove(d.id)} className="text-[10px] text-muted-foreground hover:text-rose">
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
