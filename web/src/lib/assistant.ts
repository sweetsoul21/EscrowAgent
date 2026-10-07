import { Status, REVIEW_WINDOW, type Deal } from "./deals";
import { duration, usdt } from "./format";

export type Level = "good" | "note" | "warn";
export type Finding = { level: Level; title: string; detail: string };

type Record = { asSeller: number; asBuyer: number; isContract: boolean; txCount: number } | undefined;

// Phrases that show up again and again in Nigerian P2P scams: pressure, moving off-platform,
// or paying in something that can't be traced.
const PRESSURE = [
  /urgent/i,
  /quick(ly)?/i,
  /today only/i,
  /send (it )?first/i,
  /pay (me )?(outside|direct)/i,
  /gift ?card/i,
  /itunes|steam card/i,
  /airtime/i,
  /recharge card/i,
  /pos (agent|transfer)/i,
  /pay (the )?balance (later|after)/i,
];

export function reviewNewDeal(input: {
  seller: string;
  sellerValid: boolean;
  amount: bigint | null;
  hours: number;
  terms: string;
  record: Record;
  balance?: bigint;
}): Finding[] {
  const out: Finding[] = [];
  const { amount, hours, terms, record } = input;

  if (input.sellerValid && record) {
    if (record.isContract) {
      out.push({
        level: "warn",
        title: "Seller address is a contract",
        detail: "Payouts go to whatever that contract does. Ask the seller for a normal wallet address.",
      });
    } else if (record.asSeller === 0) {
      out.push({
        level: "note",
        title: "First deal for this seller here",
        detail:
          record.txCount < 3
            ? "The address is also brand new on BOT Chain. Start small, or ask them for a past trade you can check."
            : "No finished deals on EscrowAgent yet. The money is still locked until you confirm, so you're covered.",
      });
    } else {
      out.push({
        level: "good",
        title: `${record.asSeller} completed sale${record.asSeller === 1 ? "" : "s"}`,
        detail: "Buyers released payment to this address after receiving their goods.",
      });
    }
  }

  if (amount !== null && amount > 0n) {
    if (amount >= 500_000_000n) {
      out.push({
        level: "warn",
        title: "Large amount",
        detail: `${usdt(amount)} USDT is a lot to send in one go. Consider a small test deal with this seller first.`,
      });
    }
    if (input.balance !== undefined && amount > input.balance) {
      out.push({
        level: "warn",
        title: "Not enough USDT",
        detail: "Your wallet holds less than this amount, so the deposit will fail.",
      });
    }
  }

  if (hours < 6) {
    out.push({
      level: "note",
      title: "Tight deadline",
      detail: `The seller has only ${duration(hours * 3600)} to accept. If they miss it you can take your money back.`,
    });
  } else if (hours > 14 * 24) {
    out.push({
      level: "note",
      title: "Long wait",
      detail: "Your USDT stays locked until the seller accepts or this deadline passes. A week is usually enough.",
    });
  }

  const t = terms.trim();
  if (t.length < 20) {
    out.push({
      level: "warn",
      title: "Terms are too thin",
      detail: "Write what you're buying, its condition and how it gets to you. The arbiter reads this if things go wrong.",
    });
  } else {
    const hit = PRESSURE.find((re) => re.test(t));
    if (hit) {
      out.push({
        level: "warn",
        title: "Watch for pressure",
        detail:
          "Words like “urgent”, “send first” or gift-card payments are common in scams. Keep every payment inside this deal.",
      });
    }
    if (!/\d/.test(t)) {
      out.push({
        level: "note",
        title: "Add specifics",
        detail: "Quantities, model numbers or dates make a dispute much easier to settle.",
      });
    }
  }

  if (!out.some((f) => f.level !== "good")) {
    out.push({ level: "good", title: "Looks fine", detail: "Nothing unusual about this deal." });
  }
  return out;
}

export function adviseOnDeal(deal: Deal, role: "buyer" | "seller" | "viewer", record: Record, now: number): Finding[] {
  const out: Finding[] = [];
  const s = deal.status;

  if (role === "buyer" && record && record.asSeller === 0 && s !== Status.Released) {
    out.push({
      level: "note",
      title: "New seller",
      detail: "This seller hasn't finished a deal here before. Inspect the goods carefully before you release.",
    });
  }
  if (role === "seller" && s === Status.Funded) {
    out.push({
      level: "good",
      title: `${usdt(deal.amount)} USDT is already locked`,
      detail: "The buyer can't pull it back once you accept, except by mutual cancel or a dispute.",
    });
    out.push({
      level: "note",
      title: "Don't ship before you accept",
      detail: `Accept first, then send the goods. You have ${duration(deal.acceptBy - now)} left to accept.`,
    });
  }
  if (role === "buyer" && s === Status.Funded) {
    out.push({
      level: "note",
      title: "Send the link to the seller",
      detail: "Nothing happens until they open it and accept. Share it in your chat with them.",
    });
  }
  if (role === "buyer" && (s === Status.Accepted || s === Status.Delivered)) {
    out.push({
      level: "warn",
      title: "Confirm only after you have it",
      detail: "Releasing is final. Check the item in person or test the service before you tap confirm.",
    });
  }
  if (s === Status.Delivered) {
    const left = deal.deliveredAt + REVIEW_WINDOW - now;
    out.push(
      left > 0
        ? {
            level: role === "buyer" ? "warn" : "note",
            title: `${duration(left)} left to review`,
            detail:
              role === "buyer"
                ? "After that the seller can collect the money without your confirmation. Raise a dispute before then if something is wrong."
                : "If the buyer stays quiet, you can collect the payment when this runs out.",
          }
        : {
            level: "note",
            title: "Review window has ended",
            detail: "The seller can now collect the payment.",
          }
    );
  }
  if (s === Status.Disputed) {
    out.push({
      level: "note",
      title: "Send your evidence to the arbiter",
      detail: "Screenshots of the chat, delivery receipts, photos of the item. Either of you can still agree to cancel.",
    });
  }
  if ((deal.buyerWantsCancel || deal.sellerWantsCancel) && s !== Status.Refunded) {
    const who = deal.buyerWantsCancel ? "buyer" : "seller";
    out.push({
      level: "note",
      title: `The ${who} wants to cancel`,
      detail: "If the other side agrees too, the buyer gets the full amount back.",
    });
  }
  return out;
}
