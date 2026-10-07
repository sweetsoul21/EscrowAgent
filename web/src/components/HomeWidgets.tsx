"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { isDeployed, useProtocol } from "@/lib/deals";
import { toUnits, usdt } from "@/lib/format";
import { ConnectButton, useWallet } from "./Wallet";

/** Live figures read from the contract. */
export function LiveNumbers() {
  const { data } = useProtocol();
  const items = [
    { label: "Deals opened", value: data ? data.dealCount.toLocaleString("en-US") : null },
    { label: "USDT paid to sellers", value: data ? usdt(data.totalVolume, { decimals: 0 }) : null },
    { label: "USDT held right now", value: data ? usdt(data.locked, { decimals: 0 }) : null },
    { label: "Fee per deal", value: data ? `${data.feeBps / 100}%, max 5 USDT` : null },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="bg-paper px-5 py-5">
          <dt className="text-[13px] text-muted">{i.label}</dt>
          <dd className="num mt-1.5 text-[26px] leading-none font-semibold tracking-[-0.02em]">
            {i.value ?? (isDeployed ? <span className="skeleton inline-block h-6 w-20" /> : "–")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Sellers can send buyers a link that opens the form already filled in. */
export function PayMeLink() {
  const { address, connected } = useWallet();
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");
  const [copied, setCopied] = useState(false);

  const units = toUnits(amount);
  const ready = connected && units && units >= 100_000n && terms.trim().length >= 3;

  function build() {
    const q = new URLSearchParams({ seller: address!, amount, terms: terms.trim() });
    return `${window.location.origin}/?${q.toString()}`;
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
      <h3 className="text-[20px] font-semibold tracking-[-0.01em]">Selling? Send a pay-in-escrow link</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        The buyer opens it with your address, price and item already filled in. They only have to press lock.
      </p>
      {!connected ? (
        <div className="mt-6">
          <ConnectButton className="btn-secondary" label="Connect the wallet you'll be paid to" />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-[150px_1fr_auto]">
          <div className="relative">
            <input
              className="field num pr-16"
              inputMode="decimal"
              placeholder="Price"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              aria-label="Price in USDT"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted">USDT</span>
          </div>
          <input
            className="field"
            placeholder="What you're selling"
            maxLength={280}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            aria-label="What you're selling"
          />
          <button
            className="btn-primary"
            disabled={!ready}
            onClick={() => {
              navigator.clipboard.writeText(build());
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="size-[18px]" /> : <Link2 className="size-[18px]" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
