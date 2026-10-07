"use client";

import { useState, useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ChevronDown, Copy, ExternalLink, LogOut, Wallet as WalletIcon } from "lucide-react";
import { activeChain, addressUrl } from "@/lib/chain";
import { short, usdt } from "@/lib/format";
import { useUsdtBalance } from "@/lib/deals";
import { Modal } from "./Modal";
import { useToast } from "./Toaster";

const noop = () => () => {};
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
}

function hasInjectedWallet() {
  return typeof window !== "undefined" && !!(window as { ethereum?: unknown }).ethereum;
}

/** Everything a page needs to know about the visitor's wallet. */
export function useWallet() {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useAccount();
  const connected = mounted && isConnected && !!address;
  return {
    mounted,
    address: connected ? address : undefined,
    connected,
    wrongChain: connected && chainId !== activeChain.id,
  };
}

export function useConnectWallet() {
  const { connectAsync, connectors, isPending } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const toast = useToast();
  const [noWallet, setNoWallet] = useState(false);

  async function connect() {
    if (!hasInjectedWallet()) {
      setNoWallet(true);
      return;
    }
    try {
      await connectAsync({ connector: connectors[0], chainId: activeChain.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/rejected|denied/i.test(msg)) return;
      // Some wallets connect fine but refuse the chain switch inside connect. Try once more.
      try {
        await switchChainAsync({ chainId: activeChain.id });
      } catch {
        toast({ kind: "error", title: "Couldn't connect", body: "Open your wallet and try again." });
      }
    }
  }

  const dialog = <NoWalletDialog open={noWallet} onClose={() => setNoWallet(false)} />;
  return { connect, isPending, dialog };
}

export function SwitchChainButton({ className = "btn-primary" }: { className?: string }) {
  const { switchChain, isPending } = useSwitchChain();
  return (
    <button className={className} disabled={isPending} onClick={() => switchChain({ chainId: activeChain.id })}>
      {isPending ? "Check your wallet…" : `Switch to ${activeChain.name}`}
    </button>
  );
}

export function ConnectButton({ className = "btn-primary", label = "Connect wallet" }) {
  const { connect, isPending, dialog } = useConnectWallet();
  return (
    <>
      <button className={className} onClick={connect} disabled={isPending}>
        <WalletIcon className="size-[18px]" />
        {isPending ? "Opening wallet…" : label}
      </button>
      {dialog}
    </>
  );
}

function NoWalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const here = typeof window !== "undefined" ? window.location.href : "";
  const bare = here.replace(/^https?:\/\//, "");
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Open this page in a wallet">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        Links opened from WhatsApp or Telegram load in a browser with no wallet. Open the same page inside your wallet
        app&apos;s browser to continue.
      </p>
      <div className="mt-6 grid gap-2.5">
        <a className="btn-secondary justify-between" href={`https://metamask.app.link/dapp/${bare}`}>
          Open in MetaMask <ExternalLink className="size-4 text-muted" />
        </a>
        <a
          className="btn-secondary justify-between"
          href={`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(here)}`}
        >
          Open in Trust Wallet <ExternalLink className="size-4 text-muted" />
        </a>
        <button
          className="btn-quiet justify-between"
          onClick={() => {
            navigator.clipboard.writeText(here);
            toast({ kind: "ok", title: "Link copied", body: "Paste it into your wallet's browser." });
          }}
        >
          Copy link for another wallet <Copy className="size-4" />
        </button>
      </div>
      <p className="mt-5 text-sm text-muted">On a computer, install a browser wallet such as MetaMask or Rabby.</p>
    </Modal>
  );
}

export function WalletButton() {
  const { mounted, address, connected, wrongChain } = useWallet();
  const { disconnect } = useDisconnect();
  const { data } = useUsdtBalance(address);
  const toast = useToast();
  const [open, setOpen] = useState(false);

  if (!mounted) return <div className="skeleton h-11 w-36 rounded-xl" />;
  if (!connected) return <ConnectButton className="btn-primary btn-sm h-11" label="Connect" />;
  if (wrongChain) return <SwitchChainButton className="btn-primary btn-sm h-11" />;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setOpen(false);
        }}
        className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-paper pr-3 pl-1.5 transition-colors hover:border-line-strong"
      >
        <Identicon address={address!} />
        <span className="hidden text-[15px] num sm:inline">{data ? `${usdt(data.balance)} USDT` : "…"}</span>
        <span className="font-mono text-[13px] text-ink-soft">{short(address)}</span>
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-line bg-paper p-1.5 shadow-[0_16px_40px_-16px_rgba(27,31,40,0.25)] animate-[rise_.15s_ease-out]">
          <div className="px-3 pt-2 pb-3 sm:hidden">
            <p className="text-xs text-muted">USDT balance</p>
            <p className="num text-lg font-medium">{data ? usdt(data.balance) : "…"}</p>
          </div>
          <button
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] hover:bg-mist"
            onClick={() => {
              navigator.clipboard.writeText(address!);
              toast({ kind: "ok", title: "Address copied" });
              setOpen(false);
            }}
          >
            <Copy className="size-4 text-muted" /> Copy address
          </button>
          <a
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] hover:bg-mist"
            href={addressUrl(address!)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-4 text-muted" /> View on explorer
          </a>
          <button
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] text-bad hover:bg-bad-soft"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            <LogOut className="size-4" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

/** Small deterministic avatar so people can tell addresses apart at a glance. */
export function Identicon({ address, size = 32 }: { address: string; size?: number }) {
  const hex = address.slice(2, 14);
  const hue = parseInt(hex.slice(0, 3), 16) % 360;
  const cells = Array.from({ length: 9 }, (_, i) => parseInt(hex[i + 3], 16) % 2 === 0);
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" className="shrink-0 rounded-[9px]" aria-hidden>
      <rect width="30" height="30" fill={`hsl(${hue} 70% 94%)`} />
      {cells.map((on, i) => {
        if (!on) return null;
        const row = Math.floor(i / 3);
        const col = i % 3;
        const fill = `hsl(${hue} 62% 48%)`;
        return (
          <g key={i} fill={fill}>
            <rect x={3 + col * 4} y={3 + row * 8} width="4" height="8" />
            <rect x={23 - col * 4} y={3 + row * 8} width="4" height="8" />
          </g>
        );
      })}
    </svg>
  );
}
