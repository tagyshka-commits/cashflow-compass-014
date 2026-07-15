/**
 * AI CFO edge function.
 * Non-streaming. Returns { text, proposal? } where proposal is a structured
 * tool call the client shows as a preview card and executes only after the
 * user confirms.
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Equilibrium — a private CFO for a real person.

You have the user's full financial snapshot (accounts, currencies, crypto, debts, goals, expected income, committed expenses, transactions, net worth, health score) as JSON. Treat it as ground truth.

You can also PROPOSE actions to change the user's ledger by calling one of the tools below. NEVER call a tool without the user's explicit intent in the current message ("I received…", "I spent…", "transfer…", "I lent…", "add to my goal…", etc.). A tool call is a PROPOSAL — the client shows a preview and the user confirms before anything writes to the database. Do not describe the action in prose in the same reply; the preview will render.

When the user just asks a question, answer in prose. Direct, calm, editorial. Numbers first. Short paragraphs. No emojis. Under 200 words.

For tool calls:
- Match the account by name from the snapshot (case-insensitive). If ambiguous or missing, ASK IN PROSE which account and DO NOT call the tool yet.
- Use the currency of the source account, not the user's base currency, unless the user is explicit.
- For "gave to friend for safekeeping" style requests, propose move_to_protected.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "log_income",
      description: "Record incoming money to a specific account.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          account_name: { type: "string", description: "Name of the account that received the money" },
          category: { type: "string" },
          description: { type: "string" },
        },
        required: ["amount", "currency", "account_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_expense",
      description: "Record money spent from a specific account.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          account_name: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
        },
        required: ["amount", "currency", "account_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer",
      description: "Move money from one account to another. No income or expense.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          from_account: { type: "string" },
          to_account: { type: "string" },
          description: { type: "string" },
        },
        required: ["amount", "currency", "from_account", "to_account"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lend_money",
      description: "Record money the user lent to someone. Decrements the source account; creates a debt owed_to_me.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          from_account: { type: "string" },
          borrower: { type: "string", description: "Person name" },
          due_date: { type: "string" },
        },
        required: ["amount", "currency", "from_account", "borrower"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "borrow_money",
      description: "Record money the user borrowed. Increments the target account; creates a debt i_owe.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          to_account: { type: "string" },
          lender: { type: "string" },
          due_date: { type: "string" },
        },
        required: ["amount", "currency", "to_account", "lender"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_goal",
      description: "Move money toward a savings goal from a specific account.",
      parameters: {
        type: "object",
        properties: {
          goal_name: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string" },
          from_account: { type: "string" },
        },
        required: ["goal_name", "amount", "currency", "from_account"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_to_protected",
      description: "Move money from a liquid account into protected savings held somewhere (friend, safe, envelope, cold wallet, etc.). Creates a new protected account if one with the given storage_location does not exist.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          from_account: { type: "string" },
          storage_location: { type: "string", description: "e.g. 'Friend Alex', 'Home safe', 'Envelope', 'Cold wallet'" },
          purpose: { type: "string" },
        },
        required: ["amount", "currency", "from_account", "storage_location"],
      },
    },
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, snapshot, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `USER_FINANCIAL_SNAPSHOT (JSON):\n${snapshot}` },
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
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (upstream.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (upstream.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const choice = data.choices?.[0];
    const msg = choice?.message ?? {};
    const text: string = msg.content ?? "";
    let proposal: { name: string; args: Record<string, unknown> } | null = null;
    const toolCall = msg.tool_calls?.[0];
    if (toolCall?.function?.name) {
      try {
        proposal = {
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments || "{}"),
        };
      } catch {
        proposal = null;
      }
    }

    return new Response(JSON.stringify({ text, proposal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
