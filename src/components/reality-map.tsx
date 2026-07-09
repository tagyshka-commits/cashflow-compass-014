import { fmtMoney } from "@/lib/money";
import type { FinancialSnapshot } from "@/lib/snapshot";

interface Props {
  snapshot: FinancialSnapshot;
}

export function RealityMap({ snapshot }: Props) {
  const { reality, base, health } = snapshot;

  const bandColor =
    health.band === "green" ? "text-green" : health.band === "yellow" ? "text-amber" : "text-rose";

  const cells: Array<{ label: string; value: string; tone?: string; hint?: string }> = [
    {
      label: "Available now",
      value: fmtMoney(reality.available, base, { compact: true }),
      hint: "Liquid cash + bank + cards",
    },
    {
      label: "Available crypto",
      value: fmtMoney(reality.availableCrypto, base, { compact: true }),
      hint: "Liquid digital assets in " + base,
    },
    {
      label: "Expected 30d",
      value: fmtMoney(reality.expected, base, { compact: true }),
      tone: "text-green",
      hint: "Income you're waiting on",
    },
    {
      label: "Committed",
      value: fmtMoney(reality.committed, base, { compact: true }),
      tone: "text-rose",
      hint: "Recurring + upcoming obligations",
    },
    {
      label: "Emergency reserve",
      value: fmtMoney(reality.emergency, base, { compact: true }),
      tone: "text-amber",
      hint: "Untouchable buffer",
    },
    {
      label: "Net worth",
      value: fmtMoney(reality.netWorth, base, { compact: true }),
      hint: "Assets − liabilities",
    },
  ];

  return (
    <section className="panel p-6 md:p-8">
      <header className="flex items-start justify-between gap-6 mb-6">
        <div>
          <p className="label-mono mb-2">Reality Map</p>
          <h1 className="font-display italic text-3xl md:text-4xl leading-tight">
            Where you actually stand.
          </h1>
        </div>
        <div className="text-right shrink-0">
          <p className="label-mono mb-2">Health</p>
          <p className={"ticker text-3xl md:text-4xl font-semibold " + bandColor}>
            {health.score}
          </p>
          <p className="label-mono mt-1">/ 100</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
        {cells.map((c) => (
          <div key={c.label} className="bg-surface p-4 md:p-5">
            <p className="label-mono mb-2">{c.label}</p>
            <p className={"ticker text-xl md:text-2xl font-semibold " + (c.tone ?? "")}>
              {c.value}
            </p>
            {c.hint ? (
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{c.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      {health.reasons.length > 0 && (
        <ul className="mt-5 space-y-1.5">
          {health.reasons.map((r, i) => (
            <li key={i} className="text-xs text-muted-foreground flex gap-2">
              <span className={"mt-1.5 size-1 rounded-full shrink-0 " + bandColor.replace("text-", "bg-")} />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
