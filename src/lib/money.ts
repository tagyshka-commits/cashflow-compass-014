/**
 * Money formatting + multi-currency helpers.
 *
 * The user maintains PERSONAL exchange rates (e.g. USD/TMT unofficial rate 19.0
 * vs official 3.5). These override defaults. All amounts are converted to the
 * profile's base currency for aggregation.
 */

export const CURRENCY_META: Record<string, { symbol: string; label: string }> = {
  USD: { symbol: "$", label: "US Dollar" },
  EUR: { symbol: "€", label: "Euro" },
  GBP: { symbol: "£", label: "British Pound" },
  TRY: { symbol: "₺", label: "Turkish Lira" },
  TMT: { symbol: "m.", label: "Manat" },
  RUB: { symbol: "₽", label: "Ruble" },
  CNY: { symbol: "¥", label: "Yuan" },
  BTC: { symbol: "₿", label: "Bitcoin" },
  ETH: { symbol: "Ξ", label: "Ethereum" },
  USDT: { symbol: "₮", label: "Tether" },
  USDC: { symbol: "$", label: "USDC" },
  BNB: { symbol: "BNB", label: "BNB" },
  SOL: { symbol: "◎", label: "Solana" },
  TON: { symbol: "TON", label: "Toncoin" },
  XRP: { symbol: "XRP", label: "XRP" },
};

export const FIAT_CODES = ["USD", "EUR", "GBP", "TRY", "TMT", "RUB", "CNY"];
export const CRYPTO_CODES = ["BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "TON", "XRP"];
export const ALL_CURRENCIES = [...FIAT_CODES, ...CRYPTO_CODES];

// Approximate default rates → USD. Users override per-currency in their profile.
export const DEFAULT_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  TRY: 0.031,
  TMT: 0.055, // ~ personal-rate default (18 TMT/USD)
  RUB: 0.011,
  CNY: 0.14,
  BTC: 68000,
  ETH: 3400,
  USDT: 1,
  USDC: 1,
  BNB: 600,
  SOL: 155,
  TON: 5.4,
  XRP: 0.52,
};

export function rateToUSD(code: string, personal: Record<string, number> = {}): number {
  return personal[code] ?? DEFAULT_RATES_TO_USD[code] ?? 1;
}

export function convert(
  amount: number,
  from: string,
  to: string,
  personal: Record<string, number> = {},
): number {
  const usd = amount * rateToUSD(from, personal);
  const target = rateToUSD(to, personal);
  return target === 0 ? 0 : usd / target;
}

export function fmtMoney(
  amount: number,
  currency = "USD",
  opts: { compact?: boolean; showSign?: boolean; maxFraction?: number } = {},
): string {
  const { compact = false, showSign = false, maxFraction } = opts;
  const meta = CURRENCY_META[currency];
  const isCrypto = CRYPTO_CODES.includes(currency);
  const fraction =
    maxFraction ?? (isCrypto ? (Math.abs(amount) < 1 ? 6 : 4) : Math.abs(amount) >= 1000 ? 0 : 2);

  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fraction,
    notation: compact && Math.abs(amount) >= 10000 ? "compact" : "standard",
  });
  const num = formatter.format(Math.abs(amount));
  const sign = amount < 0 ? "−" : showSign && amount > 0 ? "+" : "";

  if (meta && ["USD", "EUR", "GBP"].includes(currency)) {
    return `${sign}${meta.symbol}${num}`;
  }
  if (meta) {
    return `${sign}${num} ${currency}`;
  }
  return `${sign}${num} ${currency}`;
}
