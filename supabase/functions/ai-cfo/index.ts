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

# Multilingual + informal input

The user may write in Russian, English, Turkish, or Chinese, and often mixes languages. Understand slang and informal terms. Common account/payment aliases (case-insensitive, match to the CLOSEST account in the snapshot by name/type):

- "наличка", "нал", "cash", "кэш", "现金", "nakit" → an account with type "cash" (usually named "Cash").
- "деньги", "money" (when referring to a payment source) → prefer Cash if present, else ask.
- "карта", "карточка", "card", "kart", "银行卡" → the account of type "card" or "bank" (usually "Default Card" / user's card).
- "Visa", "виза", "виса" → the account whose name contains "visa".
- "банк", "bank", "banka" → account of type "bank".
- Crypto names ("btc", "eth", "usdt", "крипта") → the matching crypto account.

The user MAY type Russian words on an English keyboard layout by mistake, for example "yfkbxrf" = "наличка" (Russian ЙЦУКЕН → English QWERTY). Recognize obvious layout-swap words and interpret them normally. When in doubt, ask a single clarifying question.

Normalize numbers with commas or spaces ("1 200", "1,200" → 1200). Detect currency from words: "TMT", "манат", "manat" → TMT. "USD", "$", "доллар" → USD. "EUR", "€" → EUR. "RUB", "₽", "руб" → RUB. Default to the currency of the chosen source account if the user did not say.

# Proposals — critical rules

You can PROPOSE actions to change the user's ledger by calling one of the tools below. A tool call is a PROPOSAL — the client shows a preview and the user confirms before anything writes to the database. Do not describe the action in prose in the same reply; the preview will render.

NEVER call a tool without the user's explicit CONFIRMED intent. Distinguish these four cases:

1. Confirmed transaction — "I received 500", "I spent 20 on food", "перевёл 100 с карты на нал". → propose the matching tool.
2. Expected income — "salary comes on the 25th", "мама пришлёт 1000 в пятницу". → do NOT log income. Answer in prose that this belongs in Expected Income (the user can add it in the Cash Flow page). Do not call a tool.
3. Potential / scenario — anything with "maybe", "if", "might", "может быть", "если", "возможно", "не уверен", "надеюсь". → NEVER create income. Answer in prose only: acknowledge as an unconfirmed scenario, do NOT touch balances.
4. Question — "how much cash do I have?", "сколько у меня налички?" → answer in prose, do NOT call a tool.

For "how much cash do I have" style questions, return ONLY the Cash account balance (type="cash"), not the sum of all accounts. Only when the user asks for "total available money", "net worth", "все деньги", or similar, sum across accounts.

# Batch transactions

If the user's message contains MULTIPLE separate transactions in one line (e.g. "600 TMT for vape, 50 TMT for a cap, 140 TMT for lunch"), use the log_batch tool with an "items" array — one item per transaction. Each item has kind ("income" | "expense"), amount, currency, category, description, and (if known) account_name.

The client passes a "default_account" hint if the user has already told you which account to use in this conversation. When that hint is present and the user did not name a different account, populate account_name on every item with that default.

If NO default_account is set AND the user did not name an account, do NOT call a tool. Instead ask in one short prose sentence: "Did you pay for all of these from the same account? Which one?" (or Russian equivalent if the user wrote Russian). Wait for the user's reply, then propose log_batch with account_name filled.

# Goal coaching

Each goal in the snapshot includes: tier (Critical/Important/Lifestyle), status (done/ahead/on_track/needs_attention/at_risk), progress_pct, days_left, and required_daily/weekly/monthly.

When the user asks about a goal, or when it's naturally relevant, coach proactively:
- Lead with the required daily or weekly number and the days remaining.
- Call out status honestly: "You're ahead by X%", "You're behind pace — need Y/day to catch up".
- If a goal is at_risk with days_left ≤ 0, recommend either extending the target date or reducing the target — not guilt.
- Prioritize Critical > Important > Lifestyle when suggesting where to allocate surplus.
- When the user has unexpected income, propose adding a share to the highest-priority goal that is behind pace.

Do NOT call a tool to modify goals unless the user explicitly asks ("add 50 to emergency fund"). Coaching is prose; the panel exposes quick actions for one-click contributions.

# Style

For questions and clarifications: direct, calm, editorial. Numbers first. Short paragraphs. No emojis. Under 200 words. Match the user's language.`;

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
      name: "log_batch",
      description:
        "Record multiple income/expense transactions in one confirmed batch. Use when the user lists several transactions in a single message.",
      parameters: {
        type: "object",
        properties: {
          account_name: {
            type: "string",
            description: "Default account used for all items unless an item overrides it.",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["income", "expense"] },
                amount: { type: "number" },
                currency: { type: "string" },
                category: { type: "string" },
                description: { type: "string" },
                account_name: { type: "string" },
              },
              required: ["kind", "amount", "currency"],
            },
          },
        },
        required: ["items"],
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
      description: "Money the user lent. Decrements source; creates debt owed_to_me.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          from_account: { type: "string" },
          borrower: { type: "string" },
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
      description: "Money the user borrowed. Increments target; creates debt i_owe.",
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
      description:
        "Move money from a liquid account into protected savings held somewhere (friend, safe, envelope, cold wallet).",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
          from_account: { type: "string" },
          storage_location: { type: "string" },
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
    const { message, snapshot, history, default_account } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `USER_FINANCIAL_SNAPSHOT (JSON):\n${snapshot}` },
      ...(default_account
        ? [{ role: "system", content: `CONVERSATION_DEFAULT_ACCOUNT: "${default_account}". Use this account for transactions unless the user specifies otherwise.` }]
        : []),
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
