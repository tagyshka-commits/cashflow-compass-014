import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useEntityMutation } from "@/hooks/use-entity-mutation";
import { FormDialog } from "@/components/form-dialog";
import { fmtMoney, ALL_CURRENCIES, CRYPTO_CODES } from "@/lib/money";
import type { FinancialSnapshot, Account } from "@/lib/snapshot";
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
}

const emptyForm = (base: string) => ({
  name: "",
  type: "cash" as AccountType,
  currency: base,
  balance: "",
  is_emergency: false,
  is_liquid: true,
});

export function AccountsPanel({ snapshot }: Props) {
  const { user } = useAuth();
  const { create, update, remove } = useEntityMutation("accounts", {
    create: "Account added",
    update: "Account updated",
    remove: "Account removed",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm(snapshot.base));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(snapshot.base));
    setDialogOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: String(a.balance),
      is_emergency: a.is_emergency,
      is_liquid: a.is_liquid,
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const balance = Number(form.balance);
    if (!Number.isFinite(balance)) return;

    if (form.is_emergency && balance < 0) {
      const { toast } = await import("sonner");
      toast.error("Emergency reserve cannot be negative.");
      return;
    }
    if (form.type !== "card" && balance < 0) {
      const { toast } = await import("sonner");
      toast.error(`A ${form.type} account cannot be negative. Use a card or debt entry.`);
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      currency: form.currency,
      balance,
      is_emergency: form.is_emergency,
      is_liquid: form.is_liquid,
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
          <p className="label-mono mb-1">Accounts</p>
          <h3 className="font-display italic text-xl">Where your money lives.</h3>
        </div>
        <button
          onClick={openCreate}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface-2 border border-border hover:bg-elevated"
        >
          + Add
        </button>
      </header>

      <ul className="divide-y divide-border">
        {snapshot.accounts.length === 0 && (
          <li className="text-sm text-muted-foreground py-8 text-center">
            No accounts yet. Add your first to activate the CFO.
          </li>
        )}
        {snapshot.accounts.map((a) => {
          const isCrypto = CRYPTO_CODES.includes(a.currency);
          return (
            <li key={a.id} className="py-3 flex items-center justify-between gap-3 group">
              <button
                onClick={() => openEdit(a)}
                className="min-w-0 text-left flex-1 hover:opacity-80"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  {a.is_emergency && (
                    <span className="label-mono !text-[9px] px-1.5 py-0.5 rounded bg-amber/10 text-amber">
                      RESERVE
                    </span>
                  )}
                  {isCrypto && (
                    <span className="label-mono !text-[9px] px-1.5 py-0.5 rounded bg-violet/10 text-violet">
                      CRYPTO
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {a.type} · {a.currency}
                </p>
              </button>
              <div className="text-right shrink-0">
                <p className="ticker text-sm font-semibold">
                  {fmtMoney(Number(a.balance), a.currency)}
                </p>
                <div className="flex gap-2 justify-end mt-0.5">
                  <button
                    onClick={() => openEdit(a)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${a.name}"?`)) remove.mutate(a.id);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-rose"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit account" : "Add account"}
        onSubmit={submit}
        submitting={create.isPending || update.isPending}
      >
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name (e.g. Halyk Bank)"
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-ring"
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={form.type}
            onChange={(e) => {
              const type = e.target.value as AccountType;
              setForm({
                ...form,
                type,
                currency: type === "crypto" && !CRYPTO_CODES.includes(form.currency) ? "BTC" : form.currency,
              });
            }}
            className="bg-canvas border border-border rounded-md px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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
        <input
          required
          type="number"
          step="any"
          value={form.balance}
          onChange={(e) => setForm({ ...form, balance: e.target.value })}
          placeholder="Balance"
          className="w-full bg-canvas border border-border rounded-md px-3 py-2 text-sm ticker"
        />
        <div className="flex gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_emergency}
              onChange={(e) => setForm({ ...form, is_emergency: e.target.checked })}
            />
            Emergency reserve
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_liquid}
              onChange={(e) => setForm({ ...form, is_liquid: e.target.checked })}
            />
            Liquid
          </label>
        </div>
      </FormDialog>
    </section>
  );
}
