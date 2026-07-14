import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, ALL_CURRENCIES, CRYPTO_CODES } from "@/lib/money";
import type { FinancialSnapshot } from "@/lib/snapshot";
import type { Database } from "@/integrations/supabase/types";

type AccountType = Database["public"]["Enums"]["account_type"];

const TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "crypto", label: "Crypto" },
  { value: "investment", label: "Investment" },
  { value: "physical", label: "Physical asset" },
];

interface Props {
  snapshot: FinancialSnapshot;
  onChange: () => void;
}

export function AccountsPanel({ snapshot, onChange }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "cash" as AccountType,
    currency: snapshot.base,
    balance: "",
    is_emergency: false,
    is_liquid: true,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const balance = Number(form.balance);
    if (!Number.isFinite(balance)) return;

    // Validation: emergency reserves and non-card accounts cannot be negative.
    // Only credit cards may carry a negative balance (money owed).
    if (form.is_emergency && balance < 0) {
      alert("Emergency reserve cannot be negative.");
      return;
    }
    if (form.type !== "card" && balance < 0) {
      alert(`A ${form.type} account cannot have a negative balance. Use a card or a debt entry instead.`);
      return;
    }

    setSaving(true);
    await supabase.from("accounts").insert({
      user_id: user.id,
      name: form.name.trim(),
      type: form.type,
      currency: form.currency,
      balance,
      is_emergency: form.is_emergency,
      is_liquid: form.is_liquid,
    });
    setSaving(false);
    setOpen(false);
    setForm({ ...form, name: "", balance: "" });
    onChange();
  };

  const remove = async (id: string) => {
    await supabase.from("accounts").delete().eq("id", id);
    onChange();
  };

  return (
    <section className="panel p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="label-mono mb-1">Accounts</p>
          <h3 className="font-display italic text-xl">Where your money lives.</h3>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface-2 border border-border hover:bg-elevated"
        >
          {open ? "Cancel" : "+ Add"}
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="panel-inset p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name (e.g. Halyk Bank)"
              className="col-span-2 bg-canvas border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-ring"
            />
            <select
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as AccountType;
                setForm({
                  ...form,
                  type,
                  currency: type === "crypto" ? "BTC" : form.currency,
                });
              }}
              className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
            >
              {ALL_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              required
              type="number"
              step="any"
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
              placeholder="Balance"
              className="col-span-2 bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
            />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_emergency} onChange={(e) => setForm({ ...form, is_emergency: e.target.checked })} />
              Emergency reserve
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_liquid} onChange={(e) => setForm({ ...form, is_liquid: e.target.checked })} />
              Liquid
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 rounded-md bg-foreground text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add account"}
          </button>
        </form>
      )}

      <ul className="divide-y divide-border">
        {snapshot.accounts.length === 0 && (
          <li className="text-sm text-muted-foreground py-8 text-center">
            No accounts yet. Add your first to activate the CFO.
          </li>
        )}
        {snapshot.accounts.map((a) => {
          const isCrypto = CRYPTO_CODES.includes(a.currency);
          return (
            <li key={a.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  {a.is_emergency && <span className="label-mono !text-[9px] px-1.5 py-0.5 rounded bg-amber/10 text-amber">RESERVE</span>}
                  {isCrypto && <span className="label-mono !text-[9px] px-1.5 py-0.5 rounded bg-violet/10 text-violet">CRYPTO</span>}
                </div>
                <p className="text-[11px] text-muted-foreground capitalize">{a.type} · {a.currency}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="ticker text-sm font-semibold">
                  {fmtMoney(Number(a.balance), a.currency)}
                </p>
                <button onClick={() => remove(a.id)} className="text-[10px] text-muted-foreground hover:text-rose mt-0.5">Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
