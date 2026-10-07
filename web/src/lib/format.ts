import { formatUnits, parseUnits } from "viem";

export const USDT_DECIMALS = 6;

export function toUnits(value: string): bigint | null {
  const clean = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{0,6})?$/.test(clean)) return null;
  try {
    return parseUnits(clean, USDT_DECIMALS);
  } catch {
    return null;
  }
}

export function usdt(amount: bigint, opts: { decimals?: number } = {}): string {
  const n = Number(formatUnits(amount, USDT_DECIMALS));
  const max = opts.decimals ?? (n < 10 ? 2 : n >= 10_000 ? 0 : 2);
  return n.toLocaleString("en-US", { minimumFractionDigits: Math.min(2, max), maximumFractionDigits: Math.max(2, max) });
}

export function naira(amount: bigint, rate: number | undefined): string | null {
  if (!rate) return null;
  const n = Number(formatUnits(amount, USDT_DECIMALS)) * rate;
  return "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

export function short(address?: string, size = 4): string {
  if (!address) return "";
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < HOUR) return `${Math.max(1, Math.round(s / MINUTE))} min`;
  if (s < DAY) {
    const h = Math.floor(s / HOUR);
    const m = Math.round((s % HOUR) / MINUTE);
    return m && h < 6 ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(s / DAY);
  const h = Math.round((s % DAY) / HOUR);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export function ago(timestamp: number, now = Date.now() / 1000): string {
  const diff = now - timestamp;
  if (diff < 45) return "just now";
  return `${duration(diff)} ago`;
}

export function dateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
