import { createFileRoute } from "@tanstack/react-router";
import { useSnapshot } from "@/hooks/use-snapshot";
import { GoalsPanel } from "@/components/goals-panel";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsPage,
});

function GoalsPage() {
  const { snapshot, loading } = useSnapshot();
  if (loading || !snapshot) return <div className="py-24 text-center label-mono">Loading</div>;
  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <header className="mb-6">
        <p className="label-mono mb-2">Future</p>
        <h1 className="font-display italic text-4xl">What you're building toward.</h1>
      </header>
      <GoalsPanel snapshot={snapshot} />
    </div>
  );
}
