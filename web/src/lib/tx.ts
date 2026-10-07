"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BaseError, type Hash, type TransactionReceipt } from "viem";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useToast } from "@/components/Toaster";

export function errorMessage(e: unknown): string {
  if (e instanceof BaseError) {
    const rejected = e.walk((err) => (err as { name?: string }).name === "UserRejectedRequestError");
    if (rejected) return "You cancelled the request in your wallet.";
    const revert = e.walk((err) => (err as { name?: string }).name === "ContractFunctionRevertedError") as
      | { data?: { errorName?: string } }
      | null;
    const name = revert?.data?.errorName;
    if (name) return REVERT_TEXT[name] ?? `The contract refused: ${name}.`;
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

const REVERT_TEXT: Record<string, string> = {
  SelfDeal: "You can't open a deal with your own address.",
  AmountTooSmall: "The smallest deal is 0.10 USDT.",
  BadDeadline: "Pick a deadline between 1 hour and 60 days from now.",
  TermsTooLong: "Keep the terms under 280 characters.",
  ArbiterCannotTrade: "The arbiter's wallet can't buy or sell here.",
  AcceptWindowClosed: "The time to accept this deal has run out.",
  AcceptWindowOpen: "The seller still has time to accept.",
  ReviewWindowOpen: "The buyer's review window hasn't ended yet.",
  ReviewWindowClosed: "The review window has ended, so disputes are closed.",
  WrongStatus: "This deal has moved on. Refresh to see where it is now.",
  NotBuyer: "Only the buyer can do that.",
  NotSeller: "Only the seller can do that.",
  NotParty: "Only the buyer or seller can do that.",
  NotArbiter: "Only the arbiter can do that.",
  SplitTooLarge: "The buyer's share can't be more than the deal amount.",
};

/** Sends a transaction, waits for it to land, refreshes reads and reports the result. */
export function useTx() {
  const config = useConfig();
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  async function run(
    label: string,
    send: () => Promise<Hash>,
    opts: { success?: string; quiet?: boolean } = {}
  ): Promise<TransactionReceipt | null> {
    setPending(label);
    try {
      const hash = await send();
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") throw new Error("The transaction was reverted.");
      await qc.invalidateQueries();
      if (!opts.quiet) toast({ kind: "ok", title: opts.success ?? "Done", hash });
      return receipt;
    } catch (e) {
      toast({ kind: "error", title: "Transaction not completed", body: errorMessage(e) });
      return null;
    } finally {
      setPending(null);
    }
  }

  return { run, pending };
}
