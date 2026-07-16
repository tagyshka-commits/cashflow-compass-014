import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { FinancialSnapshot } from "@/lib/snapshot";
import { snapshotForAI } from "@/lib/snapshot";
import { useInvalidateSnapshot } from "@/hooks/use-snapshot";
import { describeProposal, executeProposal, type Proposal } from "@/lib/ai-tools";

interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  proposal?: Proposal | null;
  proposalState?: "pending" | "applied" | "cancelled";
}

const SUGGESTIONS = [
  "What can I actually spend this month?",
  "I received 50 USD on my Visa",
  "I spent 20 on groceries with Cash",
  "Where is my money leaking?",
];

interface Props {
  snapshot: FinancialSnapshot | null;
}

export function AiCfoChat({ snapshot }: Props) {
  const { user } = useAuth();
  const invalidate = useInvalidateSnapshot();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Remember the last account the user paid with in this session so the AI
  // can reuse it for subsequent transactions without re-asking.
  const [defaultAccount, setDefaultAccount] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("ai_messages")
      .select("id, role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages((data as Msg[]).slice().reverse());
      });
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy || !user || !snapshot) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    await supabase.from("ai_messages").insert({ user_id: user.id, role: "user", content: text });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-cfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: text,
          snapshot: snapshotForAI(snapshot),
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          default_account: defaultAccount,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `AI ${resp.status}`);

      const assistantMsg: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.text || (data.proposal ? "Here's what I'd change:" : ""),
        proposal: data.proposal ?? null,
        proposalState: data.proposal ? "pending" : undefined,
      };
      setMessages((m) => [...m, assistantMsg]);
      await supabase.from("ai_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: assistantMsg.content,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: "Couldn't reach the CFO service." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const confirmProposal = async (msg: Msg) => {
    if (!msg.proposal || !snapshot || !user) return;
    try {
      await executeProposal(msg.proposal, snapshot, user.id);
      invalidate();
      toast.success("Applied");
      setMessages((m) =>
        m.map((x) => (x.id === msg.id ? { ...x, proposalState: "applied" } : x)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply");
    }
  };

  const cancelProposal = (msg: Msg) => {
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, proposalState: "cancelled" } : x)));
  };

  return (
    <aside className="panel flex flex-col h-[calc(100vh-9rem)] sticky top-24">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="size-1.5 rounded-full bg-green animate-pulse-dot" />
          <p className="label-mono">CFO · online</p>
        </div>
        <h2 className="font-display italic text-2xl leading-tight">Your strategist.</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ask, or just tell it what happened — "I spent 20 on food", "I got paid 500 to Visa".
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && !busy && (
          <div className="space-y-2">
            <p className="label-mono">Try</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="w-full text-left text-sm p-3 rounded-lg bg-surface-2 hover:bg-elevated border border-border-subtle transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                {m.content}
              </div>
            ) : (
              <div className="space-y-2">
                {m.content && (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {m.content}
                  </div>
                )}
                {m.proposal && snapshot && (
                  <div className="panel-inset p-3 space-y-2 border border-blue/30 bg-blue/5 rounded-lg">
                    <p className="label-mono text-blue">Proposed changes</p>
                    <ul className="text-xs space-y-1 ticker">
                      {describeProposal(m.proposal, snapshot).map((line, i) => (
                        <li key={i}>· {line}</li>
                      ))}
                    </ul>
                    {m.proposalState === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => confirmProposal(m)}
                          className="flex-1 text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-primary-foreground"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => cancelProposal(m)}
                          className="text-xs px-3 py-1.5 rounded-md bg-surface-2 border border-border"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {m.proposalState === "applied" && (
                      <p className="text-[11px] text-green ticker">✓ applied</p>
                    )}
                    {m.proposalState === "cancelled" && (
                      <p className="text-[11px] text-muted-foreground ticker">cancelled</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="inline-flex gap-1 pt-2">
            <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse-dot" />
            <span
              className="size-1.5 rounded-full bg-muted-foreground animate-pulse-dot"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="size-1.5 rounded-full bg-muted-foreground animate-pulse-dot"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-4 border-t border-border"
      >
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask, or tell me what happened…"
            className="flex-1 resize-none bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-ring max-h-32"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="shrink-0 size-9 rounded-xl bg-foreground text-primary-foreground grid place-items-center disabled:opacity-40 hover:opacity-90 transition-opacity"
            aria-label="Send"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17l10-10M9 7h8v8" />
            </svg>
          </button>
        </div>
      </form>
    </aside>
  );
}
