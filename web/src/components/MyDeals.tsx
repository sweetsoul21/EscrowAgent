"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { useNow } from "@/lib/now";
import { isOpen, Status, useMyDeals, useNairaRate, type Deal } from "@/lib/deals";
import { ago, naira, short, usdt } from "@/lib/format";
import { Skeleton, StatusBadge } from "./bits";
import { ConnectButton, Identicon, SwitchChainButton, useWallet } from "./Wallet";

type Tab = "buying" | "selling";
type Filter = "open" | "closed" | "all";

/** What the person looking at the list needs to do next, if anything. */
function nextStep(d: Deal, tab: Tab, now: number): string | null {
  const s = d.status;
  if (tab === "selling") {
    if (s === Status.Funded && now <= d.acceptBy) return "Accept or decline";
    if (s === Status.Accepted) return "Deliver, then mark delivered";
    if (s === Status.Delivered && now >= d.deliveredAt + 3 * 86400) return "Collect payment";
  } else {
    if (s === Status.Funded && now > d.acceptBy) return "Take your USDT back";
    if (s === Status.Delivered) return "Check and confirm";
  }
  return null;
}

export function MyDeals() {
  const { mounted, address, connected, wrongChain } = useWallet();
  const { data, isLoading } = useMyDeals(address);
  const { data: rate } = useNairaRate();
  const [tab, setTab] = useState<Tab>("buying");
  const [filter, setFilter] = useState<Filter>("open");
  const now = useNow();

  const all = data ? data[tab] : [];
  const list = all.filter((d) => (filter === "all" ? true : filter === "open" ? isOpen(d.status) : !isOpen(d.status)));
  const lockedBuying = data?.buying.filter((d) => isOpen(d.status)).reduce((s, d) => s + d.amount, 0n) ?? 0n;
  const lockedSelling = data?.selling.filter((d) => isOpen(d.status)).reduce((s, d) => s + d.amount, 0n) ?? 0n;
  const todo = data ? [...data.buying.map((d) => nextStep(d, "buying", now)), ...data.selling.map((d) => nextStep(d, "selling", now))].filter(Boolean).length : 0;

  return (
    <div className="mx-auto max-w-[1000px] px-4 pt-10 pb-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[36px] leading-tight font-semibold tracking-[-0.025em] sm:text-[44px]">My deals</h1>
          <p className="mt-1.5 text-[16px] text-ink-soft">Everything you&apos;ve bought or sold through EscrowAgent.</p>
        </div>
        <Link href="/" className="btn-primary btn-sm h-11">
          <Plus className="size-4" /> New deal
        </Link>
      </div>

      {!mounted ? (
        <ListSkeleton />
      ) : !connected ? (
        <Empty title="Connect to see your deals" body="Deals are tied to your wallet address. There's no account to log in to.">
          <ConnectButton className="btn-primary" />
        </Empty>
      ) : wrongChain ? (
        <Empty title="Wrong network" body="Your wallet is on another chain. Switch to see deals on BOT Chain.">
          <SwitchChainButton />
        </Empty>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line">
            <Stat label="Locked as buyer" value={data ? `${usdt(lockedBuying)}` : null} sub={data ? naira(lockedBuying, rate) : null} />
            <Stat label="Coming to you" value={data ? `${usdt(lockedSelling)}` : null} sub={data ? naira(lockedSelling, rate) : null} />
            <Stat label="Need your action" value={data ? String(todo) : null} sub={todo ? "see below" : "nothing pending"} />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-mist p-1" role="tablist">
              {(["buying", "selling"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`h-10 rounded-[10px] px-4 text-[15px] transition-colors ${
                    tab === t ? "bg-paper font-medium text-ink shadow-[0_1px_2px_rgba(27,31,40,0.08)]" : "text-muted hover:text-ink"
                  }`}
                >
                  {t === "buying" ? "Buying" : "Selling"}
                  <span className="num ml-1.5 text-muted">{data ? data[t].length : ""}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(["open", "closed", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-9 rounded-full px-3.5 text-sm capitalize transition-colors ${
                    filter === f ? "bg-ink text-page" : "text-muted hover:bg-mist hover:text-ink"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {isLoading || !data ? (
            <ListSkeleton />
          ) : list.length === 0 ? (
            <Empty
              title={all.length ? `No ${filter} deals` : tab === "buying" ? "You haven't bought anything yet" : "No one has paid you through escrow yet"}
              body={
                all.length
                  ? "Try another filter."
                  : tab === "buying"
                    ? "Lock USDT for your next chat trade and send the seller the link."
                    : "Send buyers a pay-in-escrow link from the home page, or share your address."
              }
            >
              {!all.length && (
                <Link href={tab === "buying" ? "/" : "/#new"} className="btn-secondary">
                  {tab === "buying" ? "Start a deal" : "Make a pay-me link"}
                </Link>
              )}
            </Empty>
          ) : (
            <ul className="mt-5 divide-y divide-line overflow-hidden rounded-[var(--radius-panel)] border border-line bg-paper">
              {list.map((d) => (
                <Row key={d.id.toString()} deal={d} tab={tab} now={now} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Row({ deal, tab, now }: { deal: Deal; tab: Tab; now: number }) {
  const other = tab === "buying" ? deal.seller : deal.buyer;
  const step = nextStep(deal, tab, now);
  return (
    <li>
      <Link href={`/deal/${deal.id}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-mist/70">
        <Identicon address={other} size={38} />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-medium">{deal.terms || "No description"}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            <span>#{deal.id.toString()}</span>
            <span>·</span>
            <span>
              {tab === "buying" ? "to" : "from"} <span className="font-mono">{short(other)}</span>
            </span>
            <span>·</span>
            <span>{ago(deal.createdAt, now)}</span>
          </p>
          {step && <p className="mt-1.5 text-[13px] font-medium text-primary">{step} →</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="num text-[17px] font-semibold">{usdt(deal.amount)}</span>
          <StatusBadge status={deal.status} expired={deal.status === Status.Funded && now > deal.acceptBy} />
        </div>
      </Link>
    </li>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | null; sub?: string | null }) {
  return (
    <div className="bg-paper px-4 py-4 sm:px-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="num mt-1 text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-[26px]">
        {value ?? <span className="skeleton inline-block h-6 w-16" />}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted">{sub ?? " "}</p>
    </div>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="mt-8 flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-blush text-primary ring-1 ring-blush-line">
        <Inbox className="size-5" />
      </span>
      <h2 className="mt-5 text-[20px] font-semibold">{title}</h2>
      <p className="mt-2 max-w-[38ch] text-[15px] text-ink-soft">{body}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-5 divide-y divide-line rounded-[var(--radius-panel)] border border-line">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="size-[38px] rounded-[9px]" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

