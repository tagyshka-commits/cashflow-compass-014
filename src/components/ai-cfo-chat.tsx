import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { FinancialSnapshot } from "@/lib/snapshot";
import { snapshotForAI } from "@/lib/snapshot";

interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

const SUGGESTIONS = [
  "What can I actually spend this month?",
  "Should I pay down my debt or save first?",
  "How much runway do I have if income stops?",
  "Where is my money leaking?",
];

interface Props {
  snapshot: FinancialSnapshot | null;
}

export function AiCfoChat({ snapshot }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
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
  }, [messages, streaming]);

  const send = async (text: string) => {
    if (!text.trim() || streaming || !user || !snapshot) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setStreaming(true);

    // Persist user message
    await supabase.from("ai_messages").insert({
      user_id: user.id,
      role: "user",
      content: text,
    });

    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-cfo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          snapshot: snapshotForAI(snapshot),
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`AI request failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              setMessages((m) =>
                m.map((msg) => (msg.id === assistantId ? { ...msg, content: full } : msg)),
              );
            }
          } catch {
            // ignore keepalives
          }
        }
      }

      await supabase.from("ai_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: full,
      });
    } catch (e) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content:
                  "I couldn't reach the CFO service. Check that Lovable AI is available and try again.",
              }
            : msg,
        ),
      );
    } finally {
      setStreaming(false);
    }
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
          Reads your full financial picture. Answers with numbers, not vibes.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="space-y-2">
            <p className="label-mono">Try asking</p>
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
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {m.content || (
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse-dot" />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
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
            placeholder="Ask about anything financial…"
            className="flex-1 resize-none bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-ring max-h-32"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="shrink-0 size-9 rounded-xl bg-foreground text-primary-foreground grid place-items-center disabled:opacity-40 hover:opacity-90 transition-opacity"
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17l10-10M9 7h8v8" />
            </svg>
          </button>
        </div>
      </form>
    </aside>
  );
}
