import { createFileRoute } from "@tanstack/react-router";
import { useSnapshot } from "@/hooks/use-snapshot";
import { UpcomingPanel } from "@/components/upcoming-panel";

export const Route = createFileRoute("/_authenticated/cashflow")({
  head: () => ({
    meta: [
      { title: "Cash Flow — Equilibrium" },
      { name: "description", content: "Money in motion: expected income, scheduled expenses and their lifecycle, so you always know what lands and what leaves next." },
      { property: "og:title", content: "Cash Flow — Equilibrium" },
      { property: "og:description", content: "Money in motion: expected income, scheduled expenses and their lifecycle, so you always know what lands and what leaves next." },
      { property: "og:url", content: "https://cashflow-compass-014.lovable.app/cashflow" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Cash Flow — Equilibrium" },
      { name: "twitter:description", content: "Money in motion: expected income, scheduled expenses and their lifecycle, so you always know what lands and what leaves next." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://cashflow-compass-014.lovable.app/cashflow" }],
  }),
  component: CashflowPage,
});

function CashflowPage() {
  const { snapshot, loading } = useSnapshot();
  if (loading || !snapshot) return <div className="py-24 text-center label-mono">Loading</div>;
  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      <header className="mb-6">
        <p className="label-mono mb-2">Flow</p>
        <h1 className="font-display italic text-4xl">Money in motion.</h1>
      </header>
      <UpcomingPanel snapshot={snapshot} />
    </div>
  );
}
