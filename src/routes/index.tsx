import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Equilibrium — Your AI Personal CFO" },
      {
        name: "description",
        content:
          "A cockpit for your money: cash, bank, cards and crypto across currencies, with an AI CFO that tells you what you can truly afford.",
      },
      { property: "og:title", content: "Equilibrium — Your AI Personal CFO" },
      {
        property: "og:description",
        content:
          "A cockpit for your money: cash, bank, cards and crypto across currencies, with an AI CFO that tells you what you can truly afford.",
      },
      { property: "og:url", content: "https://cashflow-compass-014.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://cashflow-compass-014.lovable.app/" }],
  }),
  component: Index,
});


function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    navigate({ to: user ? "/dashboard" : "/auth" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-canvas grid place-items-center">
      <div className="flex items-center gap-3">
        <div className="size-2 rounded-full bg-blue animate-pulse-dot" />
        <span className="label-mono">Loading Equilibrium</span>
      </div>
    </div>
  );
}
