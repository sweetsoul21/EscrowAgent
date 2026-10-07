import Link from "next/link";

/** Padlock drawn as a chat bubble: money locked inside the conversation. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#2467e3" />
      <path
        d="M11.5 14.5v-3a4.5 4.5 0 0 1 9 0v3"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M10.5 14h11a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-7.2l-3.6 3v-3h-.2A2.5 2.5 0 0 1 8 22.5v-6a2.5 2.5 0 0 1 2.5-2.5z"
        fill="#fff"
      />
      <circle cx="16" cy="19.5" r="1.9" fill="#2467e3" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="EscrowAgent home">
      <LogoMark />
      <span className="text-[19px] tracking-[-0.02em]">
        <span className="font-semibold">Escrow</span>
        <span className="text-ink-soft">Agent</span>
      </span>
    </Link>
  );
}
