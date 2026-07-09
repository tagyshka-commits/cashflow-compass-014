/**
 * AI CFO edge function.
 * Receives user's financial snapshot + current question,
 * streams a strategist-level answer via Lovable AI.
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Equilibrium — a private CFO built for a real person, not an academic.

You have full read access to the user's financial snapshot (accounts, currencies, crypto, debts, goals, expected income, committed expenses, transactions, net worth, health score) in the message payload as JSON. Treat that snapshot as ground truth.

How you talk:
- Direct, calm, editorial. Never corporate. Never patronizing.
- Answer with numbers first, then the reasoning behind them.
- Use the user's base currency. Show other currencies in parentheses when relevant.
- If the user has crypto, treat it as a real asset class — never dismiss it.
- If income is unstable, plan on ranges, not fixed numbers.
- If data is missing, say exactly what's missing and how to add it — do not invent.
- Never lecture. Never say "consider consulting a professional." You ARE the professional.
- Keep answers under 200 words unless the user asks for depth.
- Use short paragraphs. Occasional bullet points OK. No headings. No emojis.

Do not repeat the snapshot back. Reason from it.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, snapshot, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `USER_FINANCIAL_SNAPSHOT (JSON):\n${snapshot}`,
      },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: message },
    ];

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages,
      }),
    });

    if (upstream.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (upstream.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
