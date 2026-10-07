"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useWriteContract } from "wagmi";
import { ArrowLeft, Check, Copy, PartyPopper, Send } from "lucide-react";
import { escrowAbi, ESCROW_ADDRESS } from "@/lib/contract";
import { addressUrl } from "@/lib/chain";
import {
  feeFor,
  isOpen,
  REVIEW_WINDOW,
  Status,
  useDeal,
  useNairaRate,
  useProtocol,
  useTrackRecord,
  type Deal,
} from "@/lib/deals";
import { adviseOnDeal } from "@/lib/assistant";
import { dateTime, duration, naira, toUnits, usdt } from "@/lib/format";
import { useTx } from "@/lib/tx";
import { useNow } from "@/lib/now";
import { AddressChip, AssistantPanel, Skeleton, StatusBadge } from "./bits";
import { Modal } from "./Modal";
import { ConnectButton, SwitchChainButton, useWallet } from "./Wallet";

type Role = "buyer" | "seller" | "arbiter" | "viewer";

export function DealView() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = /^\d+$/.test(params.id) ? BigInt(params.id) : null;
  const { data: deal, isLoading } = useDeal(id);
  const { address } = useWallet();
  const { data: protocol } = useProtocol();
  const now = useNow();

  if (id === null || (!isLoading && deal === null)) return <NotFound />;
  if (!deal) return <DealSkeleton />;

  const me = address?.toLowerCase();
  const role: Role =
    me === deal.buyer.toLowerCase()
      ? "buyer"
      : me === deal.seller.toLowerCase()
        ? "seller"
        : protocol && me === protocol.arbiter.toLowerCase()
          ? "arbiter"
          : "viewer";

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-20 sm:px-6">
      <Link href="/deals" className="inline-flex items-center gap-1.5 text-[15px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> My deals
      </Link>

      {search.get("new") && role === "buyer" && deal.status === Status.Funded && <JustCreated deal={deal} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
        <div className="grid content-start gap-6">
          <Summary deal={deal} role={role} now={now} />
          <Timeline deal={deal} now={now} />
        </div>
        <aside className="grid content-start gap-5">
          <Actions deal={deal} role={role} now={now} />
          {isOpen(deal.status) && <SharePanel deal={deal} />}
          <Advice deal={deal} role={role} now={now} />
        </aside>
      </div>
    </div>
  );
}

function Summary({ deal, role, now }: { deal: Deal; role: Role; now: number }) {
  const { data: rate } = useNairaRate();
  const fee = feeFor(deal.amount, deal.feeBps);
  const expired = deal.status === Status.Funded && now > deal.acceptBy;
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-muted">
          Deal <span className="num font-mono text-ink">#{deal.id.toString()}</span> · opened {dateTime(deal.createdAt)}
        </p>
        <StatusBadge status={deal.status} expired={expired} />
      </div>
      <p className="num mt-6 text-[44px] leading-none font-semibold tracking-[-0.03em] sm:text-[56px]">
        {usdt(deal.amount)} <span className="text-[0.5em] font-medium text-muted">USDT</span>
      </p>
      <p className="num mt-3 text-[15px] text-muted">
        {naira(deal.amount, rate) && <>≈ {naira(deal.amount, rate)} · </>}
        seller receives {usdt(deal.amount - fee)} after a {usdt(fee)} fee
      </p>

      <blockquote className="mt-6 rounded-2xl bg-mist px-5 py-4 text-[16px] leading-relaxed break-words text-ink">
        {deal.terms || <span className="text-muted">No description</span>}
      </blockquote>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Party label="Buyer" address={deal.buyer} you={role === "buyer"} kind="buyer" />
        <Party label="Seller" address={deal.seller} you={role === "seller"} kind="seller" />
      </div>
    </section>
  );
}

function Party({ label, address, you, kind }: { label: string; address: string; you: boolean; kind: "buyer" | "seller" }) {
  const { data } = useTrackRecord(address as `0x${string}`);
  const count = kind === "seller" ? data?.asSeller : data?.asBuyer;
  return (
    <div className="rounded-2xl border border-line px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">
          {label}
          {you && <span className="ml-1.5 rounded-full bg-sky px-2 py-0.5 text-[11px] font-medium text-primary-deep">You</span>}
        </span>
        <span className="text-[12px] text-muted">
          {count === undefined ? "" : `${count} completed ${kind === "seller" ? "sale" : "buy"}${count === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="mt-2">
        <AddressChip address={address} />
      </div>
    </div>
  );
}

type Step = { title: string; detail?: string; at?: number; state: "done" | "current" | "todo" | "bad" };

function buildSteps(d: Deal, now: number): Step[] {
  const steps: Step[] = [
    { title: "Buyer locked the USDT", at: d.createdAt, state: "done", detail: "Held by the escrow contract" },
  ];
  const s = d.status;

  if (d.acceptedAt) {
    steps.push({ title: "Seller accepted", at: d.acceptedAt, state: "done" });
  } else if (s === Status.Funded) {
    steps.push(
      now > d.acceptBy
        ? { title: "Seller didn't accept in time", detail: "The buyer can take the USDT back", state: "bad" }
        : { title: "Seller accepts", detail: `Deadline ${dateTime(d.acceptBy)}, ${duration(d.acceptBy - now)} left`, state: "current" }
    );
  }

  if (d.deliveredAt) {
    steps.push({ title: "Seller marked it delivered", at: d.deliveredAt, state: "done" });
  } else if (s === Status.Accepted) {
    steps.push({ title: "Seller delivers", detail: "Then marks the deal delivered", state: "current" });
  }

  if (d.disputedBy !== "0x0000000000000000000000000000000000000000") {
    steps.push({
      title: `${d.disputedBy.toLowerCase() === d.buyer.toLowerCase() ? "Buyer" : "Seller"} raised a dispute`,
      detail: s === Status.Disputed ? "Waiting for the arbiter" : undefined,
      state: s === Status.Disputed ? "bad" : "done",
    });
  }

  if (s === Status.Released) steps.push({ title: "Seller was paid", at: d.closedAt, state: "done" });
  else if (s === Status.Refunded)
    steps.push({ title: "Buyer was refunded in full", at: d.closedAt, state: "done" });
  else if (s === Status.Resolved) steps.push({ title: "Arbiter settled the deal", at: d.closedAt, state: "done" });
  else if (s === Status.Delivered) {
    const left = d.deliveredAt + REVIEW_WINDOW - now;
    steps.push({
      title: "Buyer confirms and seller is paid",
      detail: left > 0 ? `Review window: ${duration(left)} left` : "Review window over. Seller can collect",
      state: "current",
    });
  } else steps.push({ title: "Seller is paid", state: "todo" });

  return steps;
}

function Timeline({ deal, now }: { deal: Deal; now: number }) {
  const steps = useMemo(() => buildSteps(deal, now), [deal, now]);
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-semibold">Progress</h2>
        <a href={addressUrl(ESCROW_ADDRESS)} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
          Contract on explorer
        </a>
      </div>
      <ol className="mt-6">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span
                className={`absolute top-7 bottom-0 left-[11px] w-[2px] ${s.state === "done" ? "bg-primary" : "bg-line"}`}
              />
            )}
            <span
              className={`relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                s.state === "done"
                  ? "bg-primary text-white"
                  : s.state === "current"
                    ? "border-2 border-primary bg-paper"
                    : s.state === "bad"
                      ? "bg-bad text-white"
                      : "border-2 border-line bg-paper"
              }`}
            >
              {s.state === "done" && <Check className="size-3.5" strokeWidth={3} />}
              {s.state === "current" && <span className="size-2 animate-pulse rounded-full bg-primary" />}
              {s.state === "bad" && <span className="text-xs font-bold">!</span>}
            </span>
            <div className="min-w-0">
              <p className={`text-[16px] ${s.state === "todo" ? "text-muted" : "font-medium"}`}>{s.title}</p>
              <p className="mt-0.5 text-sm text-muted">
                {s.at ? dateTime(s.at) : null}
                {s.at && s.detail ? " · " : null}
                {s.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type Action = {
  fn:
    | "acceptDeal"
    | "declineDeal"
    | "markDelivered"
    | "refundBuyer"
    | "claimAfterReview"
    | "confirmReceipt"
    | "reclaimExpired"
    | "withdrawOffer"
    | "requestCancel"
    | "raiseDispute";
  label: string;
  kind: "primary" | "secondary" | "danger";
  confirm?: { title: string; body: string; cta: string };
  success: string;
};

function actionsFor(d: Deal, role: Role, now: number): { note: string; actions: Action[] } {
  const amt = `${usdt(d.amount)} USDT`;
  const s = d.status;
  const expired = now > d.acceptBy;
  const reviewLeft = d.deliveredAt + REVIEW_WINDOW - now;
  const disputeOpen = s === Status.Accepted || (s === Status.Delivered && reviewLeft > 0);

  const cancel = (mine: boolean, theirs: boolean): Action[] =>
    mine
      ? []
      : [
          {
            fn: "requestCancel",
            label: theirs ? "Agree to cancel" : "Ask to cancel",
            kind: "secondary",
            confirm: theirs
              ? { title: "Cancel the deal?", body: `The other side already asked. ${amt} goes back to the buyer right away.`, cta: "Yes, cancel it" }
              : { title: "Ask to cancel?", body: "Nothing moves until the other side agrees too. Then the buyer gets everything back.", cta: "Send request" },
            success: theirs ? "Deal cancelled, buyer refunded" : "Cancel request sent",
          },
        ];
  const dispute: Action = {
    fn: "raiseDispute",
    label: "Raise a dispute",
    kind: "danger",
    confirm: {
      title: "Raise a dispute?",
      body: "The deal freezes and the arbiter decides how to split the money. Send them your evidence afterwards. Only do this if you can't sort it out together.",
      cta: "Raise dispute",
    },
    success: "Dispute raised",
  };

  if (role === "buyer") {
    if (s === Status.Funded)
      return expired
        ? {
            note: "The seller didn't accept in time. Your USDT is yours to take back.",
            actions: [{ fn: "reclaimExpired", label: `Take back ${amt}`, kind: "primary", success: "Refunded to your wallet" }],
          }
        : {
            note: "Waiting for the seller to accept. You can still withdraw before they do.",
            actions: [
              {
                fn: "withdrawOffer",
                label: "Withdraw and refund me",
                kind: "secondary",
                confirm: { title: "Withdraw this deal?", body: `${amt} comes straight back to you and the link stops working.`, cta: "Withdraw" },
                success: "Withdrawn, USDT returned",
              },
            ],
          };
    if (s === Status.Accepted || s === Status.Delivered)
      return {
        note:
          s === Status.Delivered
            ? reviewLeft > 0
              ? `The seller says it's delivered. Check it, then confirm. ${duration(reviewLeft)} left to object.`
              : "The review window is over. The seller can now collect the payment."
            : "The seller accepted. Confirm once you have what you paid for.",
        actions: [
          {
            fn: "confirmReceipt",
            label: `Confirm and release ${amt}`,
            kind: "primary",
            confirm: { title: "Release the payment?", body: `${amt} goes to the seller (minus the fee). This can't be undone.`, cta: "I have it, release" },
            success: "Payment released to the seller",
          },
          ...cancel(d.buyerWantsCancel, d.sellerWantsCancel),
          ...(disputeOpen ? [dispute] : []),
        ],
      };
    if (s === Status.Disputed)
      return { note: "This deal is with the arbiter. You can still settle by cancelling together.", actions: cancel(d.buyerWantsCancel, d.sellerWantsCancel) };
  }

  if (role === "seller") {
    const refund: Action = {
      fn: "refundBuyer",
      label: "Refund the buyer",
      kind: "secondary",
      confirm: { title: "Refund the buyer?", body: `All ${amt} goes back to the buyer and the deal closes.`, cta: "Refund" },
      success: "Buyer refunded",
    };
    if (s === Status.Funded)
      return expired
        ? { note: "The time to accept has passed. The buyer can take the USDT back.", actions: [] }
        : {
            note: `${amt} is locked for you. Accept if you agree with the terms, then deliver.`,
            actions: [
              { fn: "acceptDeal", label: "Accept the deal", kind: "primary", success: "Deal accepted. Time to deliver" },
              {
                fn: "declineDeal",
                label: "Decline",
                kind: "secondary",
                confirm: { title: "Decline this deal?", body: `The buyer gets ${amt} back right away.`, cta: "Decline" },
                success: "Declined, buyer refunded",
              },
            ],
          };
    if (s === Status.Accepted)
      return {
        note: "Deliver what you agreed, then mark it delivered. The buyer then has 3 days to confirm or object.",
        actions: [
          { fn: "markDelivered", label: "Mark as delivered", kind: "primary", success: "Marked delivered" },
          refund,
          ...cancel(d.sellerWantsCancel, d.buyerWantsCancel),
          dispute,
        ],
      };
    if (s === Status.Delivered)
      return reviewLeft > 0
        ? {
            note: `Waiting for the buyer to confirm. If they stay quiet you can collect in ${duration(reviewLeft)}.`,
            actions: [refund, ...cancel(d.sellerWantsCancel, d.buyerWantsCancel), dispute],
          }
        : {
            note: "The buyer didn't object within 3 days. Collect your payment.",
            actions: [{ fn: "claimAfterReview", label: `Collect ${usdt(d.amount - feeFor(d.amount, d.feeBps))} USDT`, kind: "primary", success: "Payment collected" }, refund],
          };
    if (s === Status.Disputed)
      return { note: "This deal is with the arbiter. You can still refund or cancel together.", actions: [refund, ...cancel(d.sellerWantsCancel, d.buyerWantsCancel)] };
  }

  return { note: "", actions: [] };
}

function Actions({ deal, role, now }: { deal: Deal; role: Role; now: number }) {
  const { connected, wrongChain } = useWallet();
  const { writeContractAsync } = useWriteContract();
  const { run, pending } = useTx();
  const [asking, setAsking] = useState<Action | null>(null);

  async function go(a: Action) {
    const r = await run(a.fn, () =>
      writeContractAsync({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: a.fn, args: [deal.id] })
    , { success: a.success });
    if (r) setAsking(null);
  }

  let body: React.ReactNode;
  if (!isOpen(deal.status)) {
    body = <Closed deal={deal} />;
  } else if (!connected) {
    body = (
      <>
        <p className="text-[15px] leading-relaxed text-ink-soft">Connect the wallet this deal was made with to act on it.</p>
        <ConnectButton className="btn-primary mt-5 w-full" />
      </>
    );
  } else if (wrongChain) {
    body = <SwitchChainButton className="btn-primary w-full" />;
  } else if (role === "arbiter") {
    body = deal.status === Status.Disputed ? <Resolve deal={deal} /> : <p className="text-[15px] text-ink-soft">You&apos;re the arbiter. Nothing to do unless this deal is disputed.</p>;
  } else if (role === "viewer") {
    body = (
      <p className="text-[15px] leading-relaxed text-ink-soft">
        The connected wallet isn&apos;t the buyer or seller on this deal. Switch accounts in your wallet to act on it.
      </p>
    );
  } else {
    const { note, actions } = actionsFor(deal, role, now);
    body = (
      <>
        <p className="text-[15px] leading-relaxed text-ink-soft">{note}</p>
        {actions.length > 0 && (
          <div className="mt-5 grid gap-2.5">
            {actions.map((a) => (
              <button
                key={a.fn}
                className={a.kind === "primary" ? "btn-primary" : a.kind === "danger" ? "btn-danger" : "btn-secondary"}
                disabled={!!pending}
                onClick={() => (a.confirm ? setAsking(a) : go(a))}
              >
                {pending === a.fn ? "Confirm in your wallet…" : a.label}
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
      <h2 className="text-[19px] font-semibold">{role === "buyer" ? "You're buying" : role === "seller" ? "You're selling" : "What happens next"}</h2>
      <div className="mt-3">{body}</div>
      {asking?.confirm && (
        <Modal open onClose={() => setAsking(null)} title={asking.confirm.title} locked={!!pending}>
          <p className="text-[15px] leading-relaxed text-ink-soft">{asking.confirm.body}</p>
          <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
            <button className="btn-secondary" onClick={() => setAsking(null)} disabled={!!pending}>
              Go back
            </button>
            <button
              className={asking.kind === "danger" ? "btn-danger" : "btn-primary"}
              onClick={() => go(asking)}
              disabled={!!pending}
            >
              {pending ? "Confirm in wallet…" : asking.confirm.cta}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Closed({ deal }: { deal: Deal }) {
  const fee = feeFor(deal.amount, deal.feeBps);
  const text =
    deal.status === Status.Released
      ? `The seller received ${usdt(deal.amount - fee)} USDT. This deal is complete.`
      : deal.status === Status.Refunded
        ? `The buyer got all ${usdt(deal.amount)} USDT back. This deal is closed.`
        : "The arbiter split the money between buyer and seller. This deal is closed.";
  return (
    <div className="flex gap-3 rounded-2xl bg-ok-soft p-4">
      <Check className="mt-0.5 size-5 shrink-0 text-ok" />
      <p className="text-[15px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function Resolve({ deal }: { deal: Deal }) {
  const [toBuyer, setToBuyer] = useState("");
  const { writeContractAsync } = useWriteContract();
  const { run, pending } = useTx();
  const units = toUnits(toBuyer);
  const ok = units !== null && units <= deal.amount;
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-ink-soft">
        Decide how much of the {usdt(deal.amount)} USDT goes back to the buyer. The rest goes to the seller.
      </p>
      <div className="relative mt-4">
        <input className="field num pr-16" inputMode="decimal" placeholder="To buyer" value={toBuyer} onChange={(e) => setToBuyer(e.target.value)} />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted">USDT</span>
      </div>
      {ok && <p className="num mt-2 text-sm text-muted">Seller share: {usdt(deal.amount - units!)} USDT before fee</p>}
      <button
        className="btn-primary mt-4 w-full"
        disabled={!ok || !!pending}
        onClick={() =>
          run("resolve", () =>
            writeContractAsync({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: "resolveDispute", args: [deal.id, units!] })
          , { success: "Dispute settled" })
        }
      >
        {pending ? "Confirm in wallet…" : "Settle dispute"}
      </button>
    </div>
  );
}

function shareText(deal: Deal, url: string) {
  return `I've locked ${usdt(deal.amount)} USDT in escrow for: "${deal.terms}". Open the deal to accept: ${url}`;
}

function SharePanel({ deal }: { deal: Deal }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/deal/${deal.id}` : "";
  const text = shareText(deal, url);
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
      <h2 className="text-[17px] font-semibold">Share this deal</h2>
      <p className="mt-1.5 text-sm text-muted">Anyone with the link can view it. Only the buyer and seller can act.</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <a className="btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <WhatsAppGlyph /> WhatsApp
        </a>
        <a
          className="btn-secondary btn-sm"
          href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text.replace(url, "").trim())}`}
          target="_blank"
          rel="noreferrer"
        >
          <Send className="size-4 text-[#229ED9]" /> Telegram
        </a>
      </div>
      <button
        className="mt-2.5 flex w-full items-center justify-between gap-3 rounded-xl bg-mist px-4 py-3 text-left"
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        <span className="truncate font-mono text-[13px] text-ink-soft">{url.replace(/^https?:\/\//, "")}</span>
        {copied ? <Check className="size-4 shrink-0 text-ok" /> : <Copy className="size-4 shrink-0 text-muted" />}
      </button>
    </section>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#25D366"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.1z"
      />
    </svg>
  );
}

function Advice({ deal, role, now }: { deal: Deal; role: Role; now: number }) {
  const { data: record } = useTrackRecord(deal.seller);
  if (!isOpen(deal.status) || (role !== "buyer" && role !== "seller")) return null;
  const findings = adviseOnDeal(deal, role, record, now);
  return findings.length ? <AssistantPanel findings={findings} /> : null;
}

function JustCreated({ deal }: { deal: Deal }) {
  return (
    <div className="mt-6 flex items-start gap-4 rounded-[var(--radius-card)] border border-blush-line bg-blush p-6">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-paper text-primary">
        <PartyPopper className="size-5" />
      </span>
      <div>
        <p className="text-[18px] font-semibold">{usdt(deal.amount)} USDT is locked. Now send the link.</p>
        <p className="mt-1 text-[15px] text-ink-soft">Share it in your chat with the seller. They accept from this page.</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-28 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.02em]">We can&apos;t find that deal</h1>
      <p className="mt-3 text-ink-soft">Check the link you were sent. Deal numbers only exist once someone locks USDT.</p>
      <Link href="/" className="btn-primary mt-8">
        Start a new deal
      </Link>
    </div>
  );
}

export function DealSkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-20 sm:px-6">
      <Skeleton className="h-5 w-24" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
        <div className="grid gap-6">
          <Skeleton className="h-[420px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[260px] rounded-[var(--radius-card)]" />
        </div>
        <div className="grid content-start gap-5">
          <Skeleton className="h-[220px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[180px] rounded-[var(--radius-card)]" />
        </div>
      </div>
    </div>
  );
}
