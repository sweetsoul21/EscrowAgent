"use client";

import { useBlockNumber } from "wagmi";
import { activeChain, explorer } from "@/lib/chain";

/** Live block height straight from the BOT Chain RPC. */
export function BlockPill() {
  const { data, isError } = useBlockNumber({ chainId: activeChain.id, watch: { pollingInterval: 4_000 } });
  return (
    <a
      href={data ? `${explorer}/block/${data}` : explorer}
      target="_blank"
      rel="noreferrer"
      title={`${activeChain.name} latest block`}
      className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-paper px-3 text-[13px] text-ink-soft transition-colors hover:border-line-strong"
    >
      <span className="relative flex size-2">
        {!isError && data && <span className="absolute inset-0 animate-ping rounded-full bg-ok/50" />}
        <span className={`relative size-2 rounded-full ${isError ? "bg-bad" : data ? "bg-ok" : "bg-line-strong"}`} />
      </span>
      <span className="num font-mono">{data ? `#${data.toLocaleString("en-US")}` : "connecting"}</span>
    </a>
  );
}
