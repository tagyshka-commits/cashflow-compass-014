import { createFileRoute } from "@tanstack/react-router";
import { useSnapshot } from "@/hooks/use-snapshot";
import { RealityMap } from "@/components/reality-map";
import { AiCfoChat } from "@/components/ai-cfo-chat";
import { AccountsPanel } from "@/components/accounts-panel";
import { UpcomingPanel } from "@/components/upcoming-panel";
import { GoalsPanel } from "@/components/goals-panel";
import { ScenariosPanel } from "@/components/scenarios-panel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { snapshot, loading } = useSnapshot();

  if (loading || !snapshot) {
    return (
      <div className="grid place-items-center py-24">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-blue animate-pulse-dot" />
          <span className="label-mono">Reading your position</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 animate-fade-up">
      <div className="space-y-6 min-w-0">
        <RealityMap snapshot={snapshot} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AccountsPanel snapshot={snapshot} />
          <UpcomingPanel snapshot={snapshot} />
        </div>
        <GoalsPanel snapshot={snapshot} />
        <ScenariosPanel snapshot={snapshot} />
      </div>
      <AiCfoChat snapshot={snapshot} />
    </div>
  );
}
