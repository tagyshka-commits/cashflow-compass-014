import { createFileRoute } from "@tanstack/react-router";
import { useSnapshot } from "@/hooks/use-snapshot";
import { AccountsPanel } from "@/components/accounts-panel";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

function AccountsPage() {
  const { snapshot, loading, refresh } = useSnapshot();
  if (loading || !snapshot) return <div className="py-24 text-center label-mono">Loading</div>;
  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      <header className="mb-6">
        <p className="label-mono mb-2">Ledger</p>
        <h1 className="font-display italic text-4xl">Every place your money exists.</h1>
      </header>
      <AccountsPanel snapshot={snapshot} onChange={refresh} />
    </div>
  );
}
