"use client";

import { Check, Copy, ExternalLink, ShieldAlert, ShieldCheck, Info } from "lucide-react";
import { useState } from "react";
import { addressUrl } from "@/lib/chain";
import { Status, STATUS_LABEL } from "@/lib/deals";
import type { Finding } from "@/lib/assistant";
import { short } from "@/lib/format";
import { Identicon } from "./Wallet";

const STATUS_STYLE: Record<Status, string> = {
  [Status.None]: "bg-mist text-muted",
  [Status.Funded]: "bg-sky-soft text-primary-deep",
  [Status.Accepted]: "bg-sky text-primary-deep",
  [Status.Delivered]: "bg-warn-soft text-warn",
  [Status.Disputed]: "bg-bad-soft text-bad",
  [Status.Released]: "bg-ok-soft text-ok",
  [Status.Refunded]: "bg-mist text-ink-soft",
  [Status.Resolved]: "bg-mist text-ink-soft",
};

export function StatusBadge({ status, expired }: { status: Status; expired?: boolean }) {
  const label = expired && status === Status.Funded ? "Expired" : STATUS_LABEL[status];
  const style = expired && status === Status.Funded ? "bg-mist text-ink-soft" : STATUS_STYLE[status];
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function AddressChip({ address, label }: { address: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Identicon address={address} size={26} />
      <span className="min-w-0">
        {label && <span className="block text-xs text-muted">{label}</span>}
        <a
          href={addressUrl(address)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[14px] text-ink hover:text-primary"
          title={address}
        >
          {short(address, 5)}
        </a>
      </span>
      <button
        className="rounded-md p-1 text-muted hover:bg-mist hover:text-ink"
        aria-label="Copy address"
        onClick={() => {
          navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  );
}

export function TxLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
      {children} <ExternalLink className="size-3.5" />
    </a>
  );
}

const FINDING_STYLE = {
  good: { icon: ShieldCheck, tone: "text-ok" },
  note: { icon: Info, tone: "text-primary" },
  warn: { icon: ShieldAlert, tone: "text-warn" },
} as const;

/** The Deal Assistant: rule-based checks that run in the browser, no data leaves the page. */
export function AssistantPanel({ findings, title = "Deal Assistant" }: { findings: Finding[]; title?: string }) {
  const warnings = findings.filter((f) => f.level === "warn").length;
  return (
    <section className="rounded-[var(--radius-card)] border border-blush-line bg-blush p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[17px] font-semibold">
          <AssistantGlyph />
          {title}
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            warnings ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"
          }`}
        >
          {warnings ? `${warnings} to check` : "All clear"}
        </span>
      </div>
      <ul className="mt-4 space-y-3.5">
        {findings.map((f) => {
          const { icon: Icon, tone } = FINDING_STYLE[f.level];
          return (
            <li key={f.title} className="flex gap-3">
              <Icon className={`mt-0.5 size-[18px] shrink-0 ${tone}`} />
              <div>
                <p className="text-[15px] font-medium">{f.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{f.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 border-t border-blush-line pt-3 text-xs text-muted">
        Checks run in your browser using on-chain history. Nothing is sent anywhere.
      </p>
    </section>
  );
}

function AssistantGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <rect x="1" y="1" width="18" height="18" rx="6" fill="var(--color-primary)" />
      <path d="M6 9.5l2.6 2.6L14 6.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}
