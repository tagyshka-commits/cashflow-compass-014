import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Equilibrium" },
      {
        name: "description",
        content:
          "Sign in or create your Equilibrium account to open your Personal CFO cockpit and pick up where your money left off.",
      },
      { property: "og:title", content: "Sign in — Equilibrium" },
      {
        property: "og:description",
        content: "Sign in or create your Equilibrium account to open your Personal CFO cockpit.",
      },
      { property: "og:url", content: "https://cashflow-compass-014.lovable.app/auth" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Sign in — Equilibrium" },
      {
        name: "twitter:description",
        content: "Sign in or create your Equilibrium account to open your Personal CFO cockpit.",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://cashflow-compass-014.lovable.app/auth" }],
  }),

  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome. Your CFO is calibrating.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas grid lg:grid-cols-2">
      {/* Editorial left panel */}
      <aside className="hidden lg:flex flex-col justify-between p-12 border-r border-border bg-surface/40">
        <Link to="/" className="flex items-center gap-3">
          <div className="size-7 rounded-md bg-foreground text-primary-foreground grid place-items-center font-mono text-xs font-bold">
            E
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.2em]">Equilibrium</span>
        </Link>

        <div className="max-w-md">
          <p className="label-mono">Personal CFO / System v.1</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] text-foreground">
            A cockpit for<br />your money.
          </h1>
          <p className="mt-6 text-base text-muted-foreground leading-relaxed">
            Cash, cards, bank, crypto — across every currency that touches your
            life. Ask your AI CFO what you can afford, what to prioritize, and
            what risks lie ahead.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="text-blue">◆</span> Reality-based cash flow, not fantasy budgets
            </li>
            <li className="flex gap-3">
              <span className="text-green">◆</span> Multi-currency with personal exchange rates
            </li>
            <li className="flex gap-3">
              <span className="text-amber">◆</span> Crypto liquidity treated separately from cash
            </li>
          </ul>
        </div>

        <p className="font-mono text-[10px] text-muted-foreground italic">
          "Financial clarity is the precursor to creative freedom."
        </p>
      </aside>

      {/* Auth form */}
      <main className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="size-7 rounded-md bg-foreground text-primary-foreground grid place-items-center font-mono text-xs font-bold">
              E
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.2em]">Equilibrium</span>
          </div>

          <p className="label-mono">
            {mode === "signin" ? "Return to system" : "Initiate account"}
          </p>
          <h2 className="mt-2 font-display text-4xl text-foreground">
            {mode === "signin" ? "Welcome back." : "Meet your CFO."}
          </h2>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-8 w-full flex items-center justify-center gap-3 rounded-full border border-border bg-surface px-4 py-3 text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="label-mono">or with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field
                label="Name"
                type="text"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Kemal"
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@domain.com"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />

            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full rounded-full bg-foreground text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.7-2.6C17 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 11.4-4.9 11.4-11.7 0-.8-.1-1.3-.2-1.9H12z" />
    </svg>
  );
}
