import { useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateSnapshot } from "@/hooks/use-snapshot";
import { fmtMoney } from "@/lib/money";
import { coachGoal } from "@/lib/goal-coach";
import type { FinancialSnapshot } from "@/lib/snapshot";

interface Props {
  snapshot: FinancialSnapshot;
}

type Severity = "overdue" | "today" | "soon" | "info";

interface InboxItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  amount?: { value: number; currency: string; sign: "+" | "−" };
  actions: { label: string; run: () => Promise<void> | void; tone?: "primary" | "muted" }[];
}

const sevOrder: Record<Severity, number> = { overdue: 0, today: 1, soon: 2, info: 3 };
const sevStyles: Record<Severity, { dot: string; label: string; text: string }> = {
  overdue: { dot: "bg-rose", label: "Overdue", text: "text-rose" },
  today: { dot: "bg-blue", label: "Today", text: "text-blue" },
  soon: { dot: "bg-amber", label: "Soon", text: "text-amber" },
  info: { dot: "bg-muted-foreground", label: "Note", text: "text-muted-foreground" },
};

function daysBetween(iso: string, from = new Date()): number {
  const a = new Date(iso + "T00:00:00");
  const b = new Date(from.toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function InboxPanel({ snapshot }: Props) {
  const invalidate = useInvalidateSnapshot();
  const today = new Date().toISOString().slice(0, 10);

  const items = useMemo<InboxItem[]>(() => {
    const list: InboxItem[] = [];

    const delayIncome = async (id: string) => {
      const next = new Date();
      next.setDate(next.getDate() + 3);
      const iso = next.toISOString().slice(0, 10);
      const { error } = await supabase
        .from("expected_incomes")
        .update({ status: "delayed", expected_date: iso })
        .eq("id", id);
      if (error) toast.error(error.message);
      else {
        toast.success("Pushed 3 days");
        invalidate();
      }
    };
    const delayExpense = async (id: string) => {
      const next = new Date();
      next.setDate(next.getDate() + 3);
      const iso = next.toISOString().slice(0, 10);
      const { error } = await supabase
        .from("committed_expenses")
        .update({ status: "delayed", due_date: iso })
        .eq("id", id);
      if (error) toast.error(error.message);
      else {
        toast.success("Pushed 3 days");
        invalidate();
      }
    };

    const dismiss = async (
      table: "expected_incomes" | "committed_expenses",
      id: string,
    ) => {
      const { error } = await supabase.from(table).update({ status: "cancelled" }).eq("id", id);
      if (error) toast.error(error.message);
      else {
        toast.success("Dismissed");
        invalidate();
      }
    };

    // Expected incomes
    for (const inc of snapshot.expected) {
      if (!inc.expected_date) continue;
      const d = daysBetween(inc.expected_date);
      if (d > 3) continue;
      const sev: Severity = d < 0 ? "overdue" : d === 0 ? "today" : "soon";
      list.push({
        id: "inc-" + inc.id,
        severity: sev,
        title: inc.source,
        detail:
          sev === "overdue"
            ? `Expected ${Math.abs(d)}d ago · ${inc.confidence ?? "likely"}`
            : sev === "today"
              ? `Expected today · ${inc.confidence ?? "likely"}`
              : `In ${d}d · ${inc.confidence ?? "likely"}`,
        amount: { value: Number(inc.amount), currency: inc.currency, sign: "+" },
        actions: [
          {
            label: "Delay 3d",
            run: () => delayIncome(inc.id),
            tone: "muted",
          },
          { label: "Dismiss", run: () => dismiss("expected_incomes", inc.id), tone: "muted" },
        ],
      });
    }

    // Committed expenses
    for (const exp of snapshot.committed) {
      if (!exp.due_date) continue;
      const d = daysBetween(exp.due_date);
      if (d > 3) continue;
      const sev: Severity = d < 0 ? "overdue" : d === 0 ? "today" : "soon";
      list.push({
        id: "exp-" + exp.id,
        severity: sev,
        title: exp.name,
        detail:
          sev === "overdue"
            ? `Due ${Math.abs(d)}d ago`
            : sev === "today"
              ? "Due today"
              : `Due in ${d}d`,
        amount: { value: Number(exp.amount), currency: exp.currency, sign: "−" },
        actions: [
          {
            label: "Delay 3d",
            run: () => delayExpense(exp.id),
            tone: "muted",
          },
          { label: "Cancel", run: () => dismiss("committed_expenses", exp.id), tone: "muted" },
        ],
      });
    }

    // Debts nearing due
    for (const d of snapshot.debts) {
      if (!d.due_date) continue;
      const days = daysBetween(d.due_date);
      if (days > 3) continue;
      const sev: Severity = days < 0 ? "overdue" : days === 0 ? "today" : "soon";
      list.push({
        id: "debt-" + d.id,
        severity: sev,
        title: d.name,
        detail:
          (d.direction === "i_owe" ? "You owe · " : "Owed to you · ") +
          (sev === "overdue" ? `${Math.abs(days)}d late` : sev === "today" ? "due today" : `in ${days}d`),
        amount: {
          value: Number(d.amount),
          currency: d.currency,
          sign: d.direction === "i_owe" ? "−" : "+",
        },
        actions: [],
      });
    }

    // Goal nudges
    for (const g of snapshot.goals) {
      const c = coachGoal(g);
      if (c.status === "at_risk" || c.status === "needs_attention") {
        list.push({
          id: "goal-" + g.id,
          severity: c.status === "at_risk" ? "overdue" : "soon",
          title: g.name,
          detail:
            c.required.daily != null
              ? `${c.status === "at_risk" ? "Off pace" : "Falling behind"} · save ${fmtMoney(c.required.daily, g.currency)}/day`
              : `${c.status === "at_risk" ? "Off pace" : "Falling behind"}`,
          actions: [],
        });
      }
    }

    // Emergency runway warning
    const monthly = snapshot.reality.committed || 1;
    const runway = snapshot.reality.emergency / monthly;
    if (runway < 1 && snapshot.reality.committed > 0) {
      list.push({
        id: "runway",
        severity: "overdue",
        title: "Emergency reserve is thin",
        detail: `Under one month of commitments (${runway.toFixed(1)}m runway)`,
        actions: [],
      });
    }

    return list.sort(
      (a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.title.localeCompare(b.title),
    );
  }, [snapshot, invalidate]);

  return (
    <section className="panel p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="label-mono mb-1">Inbox · today</p>
          <h2 className="font-display italic text-xl">What needs you.</h2>
        </div>
        <span className="text-xs text-muted-foreground ticker">{items.length}</span>
      </header>

      {items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-display italic text-lg">All clear.</p>
          <p className="text-xs text-muted-foreground mt-1">Nothing overdue or due soon.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i) => {
            const s = sevStyles[i.severity];
            return (
              <li key={i.id} className="py-3">
                <div className="flex items-start gap-3">
                  <div className={"size-2 rounded-full mt-1.5 shrink-0 " + s.dot} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{i.title}</p>
                      <span className={"text-[10px] font-mono uppercase tracking-wider " + s.text}>
                        {s.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{i.detail}</p>
                    {i.actions.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {i.actions.map((a) => (
                          <button
                            key={a.label}
                            onClick={() => a.run()}
                            className="text-[10px] px-2 py-1 rounded bg-surface-2 text-muted-foreground hover:bg-elevated hover:text-foreground"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {i.amount && (
                    <p
                      className={
                        "ticker text-sm font-semibold shrink-0 " +
                        (i.amount.sign === "+" ? "text-green" : "text-rose")
                      }
                    >
                      {i.amount.sign}
                      {fmtMoney(i.amount.value, i.amount.currency)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
