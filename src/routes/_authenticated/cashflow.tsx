import { createFileRoute } from "@tanstack/react-router";
import { useSnapshot } from "@/hooks/use-snapshot";
import { UpcomingPanel } from "@/components/upcoming-panel";

export const Route = createFileRoute("/_authenticated/cashflow")({
  component: CashflowPage,
});

function CashflowPage() {
  const { snapshot, loading, refresh } = useSnapshot();
  if (loading || !snapshot) return <div className="py-24 text-center label-mono">Loading</div>;
  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      <header className="mb-6">
        <p className="label-mono mb-2">Flow</p>
        <h1 className="font-display italic text-4xl">Money in motion.</h1>
      </header>
      <UpcomingPanel snapshot={snapshot} onChange={refresh} />
    </div>
  );
}
