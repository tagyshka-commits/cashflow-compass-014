import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/accounts", label: "Accounts" },
  { to: "/cashflow", label: "Cash flow" },
  { to: "/goals", label: "Goals" },
  { to: "/debts", label: "Debts" },
] as const;

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-canvas grid place-items-center">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-blue animate-pulse-dot" />
          <span className="label-mono">Calibrating</span>
        </div>
      </div>
    );
  }

  const initials = (user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <header className="border-b border-border bg-canvas/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="size-7 rounded-md bg-foreground text-primary-foreground grid place-items-center font-mono text-xs font-bold">
              E
            </div>
            <div className="hidden sm:block">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground leading-none">
                Personal CFO
              </p>
              <p className="font-display text-base leading-tight">Equilibrium</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "px-4 py-1.5 text-xs font-medium rounded-full transition-colors " +
                    (active
                      ? "bg-foreground text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
              <button className="px-3 py-1 text-[11px] font-medium rounded-full bg-foreground text-primary-foreground">
                Personal
              </button>
              <button className="px-3 py-1 text-[11px] font-medium text-muted-foreground opacity-50" title="Coming soon">
                Family
              </button>
              <button className="px-3 py-1 text-[11px] font-medium text-muted-foreground opacity-50" title="Coming soon">
                Business
              </button>
            </div>

            <button
              onClick={() => signOut().then(() => navigate({ to: "/auth" }))}
              className="size-9 rounded-full bg-surface border border-border grid place-items-center hover:bg-surface-2 transition-colors"
              title="Sign out"
            >
              <span className="font-mono text-[10px]">{initials}</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden border-t border-border overflow-x-auto">
          <div className="flex items-center gap-1 px-4 py-2 min-w-max">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap " +
                    (active
                      ? "bg-foreground text-primary-foreground"
                      : "text-muted-foreground")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 md:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
