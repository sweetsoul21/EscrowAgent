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
  // Two decimals normally, more only when needed so fees like 0.175 aren't rounded away.
  const max = opts.decimals ?? (n >= 10_000 ? 0 : 4);
  return n.toLocaleString("en-US", { minimumFractionDigits: Math.min(2, max), maximumFractionDigits: max });
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
const DAY = 86400;

export function duration(seconds: number): string {
  // Round the total first, then split, so 2 d 23.9 h reads "3 d" and never "2 d 24 h".
  const minutes = Math.max(1, Math.round(Math.max(0, seconds) / MINUTE));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < (DAY / MINUTE) * 0.99) {
    if (minutes < 6 * 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m ? `${h} h ${m} min` : `${h} h`;
    }
    return `${Math.round(minutes / 60)} h`;
  }
  const hours = Math.round(minutes / 60);
  const d = Math.floor(hours / 24);
  const h = hours % 24;
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
