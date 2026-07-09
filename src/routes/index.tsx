import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
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
