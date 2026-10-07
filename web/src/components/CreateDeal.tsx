"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isAddress, parseEventLogs, erc20Abi, type Address } from "viem";
import { useWriteContract } from "wagmi";
import { ArrowRight, Check, Loader2, Lock } from "lucide-react";
import { escrowAbi, ESCROW_ADDRESS, USDT_ADDRESS } from "@/lib/contract";
import { feeFor, isDeployed, useNairaRate, useProtocol, useTrackRecord, useUsdtBalance } from "@/lib/deals";
import { reviewNewDeal } from "@/lib/assistant";
import { naira, short, toUnits, usdt } from "@/lib/format";
import { useTx } from "@/lib/tx";
import { AssistantPanel } from "./bits";
import { Modal } from "./Modal";
import { ConnectButton, SwitchChainButton, useWallet } from "./Wallet";

const WINDOWS = [
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
];

export function CreateDealForm() {
  const params = useSearchParams();
  const [seller, setSeller] = useState(params.get("seller") ?? "");
  const [amount, setAmount] = useState(params.get("amount") ?? "");
  const [terms, setTerms] = useState((params.get("terms") ?? "").slice(0, 280));
  const [hours, setHours] = useState(72);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { address, connected, wrongChain } = useWallet();
  const { data: wallet } = useUsdtBalance(address);
  const { data: rate } = useNairaRate();
  const { data: protocol } = useProtocol();

  const sellerValid = isAddress(seller.trim());
  const sellerAddr = sellerValid ? (seller.trim() as Address) : undefined;
  const { data: record } = useTrackRecord(sellerAddr);
  const units = toUnits(amount);
  const feeBps = protocol?.feeBps ?? 50;
  const fee = units ? feeFor(units, feeBps) : 0n;

  const errors = {
    seller: !seller
      ? "Paste the seller's wallet address"
      : !sellerValid
        ? "That isn't a valid wallet address"
        : address && seller.trim().toLowerCase() === address.toLowerCase()
          ? "That's your own address"
          : null,
    amount: !amount
      ? "Enter an amount"
      : units === null
        ? "Use numbers only, up to 6 decimals"
        : units < 100_000n
          ? "The smallest deal is 0.10 USDT"
          : wallet && units > wallet.balance
            ? `You have ${usdt(wallet.balance)} USDT`
            : null,
    terms: terms.trim().length < 3 ? "Describe what you're paying for" : null,
  };
  const valid = !errors.seller && !errors.amount && !errors.terms;

  const findings = reviewNewDeal({
    seller,
    sellerValid,
    amount: units,
    hours,
    terms,
    record,
    balance: wallet?.balance,
  });
  const showAssistant = sellerValid || !!units || terms.length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (valid) setConfirming(true);
  }

  return (
    <div className="grid gap-5">
      <form
        onSubmit={submit}
        noValidate
        className="rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-[0_24px_60px_-36px_rgba(36,103,227,0.35)] sm:p-8"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Lock money for a deal</h2>
          <span className="text-sm text-muted">You&apos;re the buyer</span>
        </div>

        <div className="mt-6 grid gap-5">
          <div>
            <label htmlFor="seller" className="label">
              Seller&apos;s wallet address
            </label>
            <input
              id="seller"
              className="field font-mono text-[15px]"
              placeholder="0x…"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <FieldNote error={touched ? errors.seller : null}>
              {sellerValid && record
                ? record.asSeller
                  ? `${record.asSeller} completed sale${record.asSeller === 1 ? "" : "s"} on EscrowAgent`
                  : "No completed sales here yet"
                : "Ask them to paste it in your chat"}
            </FieldNote>
          </div>

          <div>
            <label htmlFor="amount" className="label">
              Amount
            </label>
            <div className="relative">
              <input
                id="amount"
                className="field num pr-20 text-[20px] font-medium"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                autoComplete="off"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[15px] font-medium text-muted">
                USDT
              </span>
            </div>
            <FieldNote error={touched ? errors.amount : null}>
              {units ? (
                <>
                  {naira(units, rate) ? `≈ ${naira(units, rate)} · ` : ""}
                  Seller receives {usdt(units - fee)} after a {usdt(fee)} fee
                </>
              ) : wallet ? (
                `Balance: ${usdt(wallet.balance)} USDT`
              ) : (
                "Paid in USDT on BOT Chain"
              )}
            </FieldNote>
          </div>

          <div>
            <span className="label">Seller must accept within</span>
            <div className="grid grid-cols-4 gap-2">
              {WINDOWS.map((w) => (
                <button
                  key={w.hours}
                  type="button"
                  onClick={() => setHours(w.hours)}
                  className={`h-11 rounded-xl border text-[15px] transition-colors ${
                    hours === w.hours
                      ? "border-primary bg-sky-soft font-medium text-primary-deep"
                      : "border-line text-ink-soft hover:border-line-strong"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-muted">If they don&apos;t, you take your USDT back.</p>
          </div>

          <div>
            <label htmlFor="terms" className="label flex justify-between">
              What you&apos;re paying for
              <span className={`num font-normal ${terms.length > 260 ? "text-warn" : "text-muted"}`}>
                {terms.length}/280
              </span>
            </label>
            <textarea
              id="terms"
              rows={3}
              maxLength={280}
              className="field resize-none py-3.5 leading-snug"
              placeholder="e.g. Used iPhone 12, 128GB, no scratches. Delivered to Ikeja by Friday."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
            <FieldNote error={touched ? errors.terms : null}>Stored on-chain. The arbiter reads this in a dispute.</FieldNote>
          </div>
        </div>

        <div className="mt-7">
          {!isDeployed ? (
            <p className="rounded-xl bg-mist px-4 py-3 text-[15px] text-ink-soft">The escrow contract isn&apos;t live yet.</p>
          ) : !connected ? (
            <ConnectButton className="btn-primary w-full" label="Connect wallet to continue" />
          ) : wrongChain ? (
            <SwitchChainButton className="btn-primary w-full" />
          ) : (
            <button type="submit" className="btn-primary w-full">
              <Lock className="size-[18px]" />
              {units && !errors.amount ? `Lock ${usdt(units)} USDT` : "Lock USDT"}
            </button>
          )}
        </div>
      </form>

      {showAssistant && <AssistantPanel findings={findings} />}

      {confirming && units && sellerAddr && (
        <ConfirmCreate
          seller={sellerAddr}
          amount={units}
          fee={fee}
          hours={hours}
          terms={terms.trim()}
          allowance={wallet?.allowance ?? 0n}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function FieldNote({ error, children }: { error: string | null; children: React.ReactNode }) {
  return error ? (
    <p className="mt-2 text-[13px] text-bad">{error}</p>
  ) : (
    <p className="mt-2 text-[13px] text-muted">{children}</p>
  );
}

function ConfirmCreate(props: {
  seller: Address;
  amount: bigint;
  fee: bigint;
  hours: number;
  terms: string;
  allowance: bigint;
  onClose: () => void;
}) {
  const router = useRouter();
  const { writeContractAsync } = useWriteContract();
  const { run, pending } = useTx();
  const needsApproval = props.allowance < props.amount;
  const [approved, setApproved] = useState(!needsApproval);

  async function approve() {
    const r = await run(
      "approve",
      () =>
        writeContractAsync({
          address: USDT_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [ESCROW_ADDRESS, props.amount],
        }),
      { success: "USDT approved" }
    );
    if (r) setApproved(true);
  }

  async function lock() {
    const acceptBy = BigInt(Math.floor(Date.now() / 1000) + props.hours * 3600);
    const r = await run(
      "lock",
      () =>
        writeContractAsync({
          address: ESCROW_ADDRESS,
          abi: escrowAbi,
          functionName: "createDeal",
          args: [props.seller, props.amount, acceptBy, props.terms],
        }),
      { success: "Your USDT is locked" }
    );
    if (!r) return;
    const [log] = parseEventLogs({ abi: escrowAbi, logs: r.logs, eventName: "DealCreated" });
    if (log) router.push(`/deal/${log.args.id}?new=1`);
  }

  const steps = [
    ...(needsApproval ? [{ key: "approve", title: "Allow EscrowAgent to move this USDT", done: approved }] : []),
    { key: "lock", title: `Lock ${usdt(props.amount)} USDT in escrow`, done: false },
  ];

  return (
    <Modal open onClose={props.onClose} title="Check the deal" locked={!!pending}>
      <dl className="divide-y divide-line rounded-2xl border border-line text-[15px]">
        <Row label="You lock" value={`${usdt(props.amount)} USDT`} strong />
        <Row label="Seller" value={<span className="font-mono text-sm">{short(props.seller, 6)}</span>} />
        <Row label="Seller receives" value={`${usdt(props.amount - props.fee)} USDT`} />
        <Row label="Accept within" value={WINDOWS.find((w) => w.hours === props.hours)?.label ?? `${props.hours} h`} />
      </dl>
      <p className="mt-3 line-clamp-3 rounded-xl bg-mist px-4 py-3 text-sm text-ink-soft">“{props.terms}”</p>

      <ol className="mt-6 space-y-3">
        {steps.map((s, i) => {
          const active = !s.done && (s.key === "approve" || approved);
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  s.done ? "bg-ok text-white" : active ? "bg-primary text-white" : "bg-mist text-muted"
                }`}
              >
                {s.done ? <Check className="size-4" /> : pending === s.key ? <Loader2 className="size-4 animate-spin" /> : i + 1}
              </span>
              <span className={`text-[15px] ${active || s.done ? "text-ink" : "text-muted"}`}>{s.title}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-7">
        {!approved ? (
          <button className="btn-primary w-full" onClick={approve} disabled={!!pending}>
            {pending ? "Confirm in your wallet…" : "Approve USDT"}
          </button>
        ) : (
          <button className="btn-primary w-full" onClick={lock} disabled={!!pending}>
            {pending ? "Locking…" : (
              <>
                Lock and get the link <ArrowRight className="size-[18px]" />
              </>
            )}
          </button>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`num text-right ${strong ? "text-[17px] font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

export function CreateDealSkeleton() {
  return <div className="skeleton h-[640px] rounded-[var(--radius-card)]" />;
}
