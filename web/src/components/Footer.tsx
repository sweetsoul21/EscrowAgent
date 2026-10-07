import Link from "next/link";
import { ESCROW_ADDRESS, USDT_ADDRESS } from "@/lib/contract";
import { addressUrl } from "@/lib/chain";
import { BlockPill } from "./BlockPill";
import { LogoMark } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-mist/60">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">EscrowAgent</span>
          </div>
          <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-muted">
            USDT escrow for deals you make in a chat. Built for buyers and sellers in Nigeria and anywhere else.
          </p>
          <div className="mt-5">
            <BlockPill />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink">Use it</h3>
          <ul className="mt-4 space-y-2.5 text-[15px] text-muted">
            <li>
              <Link href="/" className="hover:text-ink">
                Lock money for a deal
              </Link>
            </li>
            <li>
              <Link href="/deals" className="hover:text-ink">
                Deals you&apos;re in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink">On-chain</h3>
          <ul className="mt-4 space-y-2.5 text-[15px] text-muted">
            <li>
              <a href={addressUrl(ESCROW_ADDRESS)} target="_blank" rel="noreferrer" className="hover:text-ink">
                Escrow contract
              </a>
            </li>
            <li>
              <a href={addressUrl(USDT_ADDRESS)} target="_blank" rel="noreferrer" className="hover:text-ink">
                USDT token
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink">Built on BOT Chain</h3>
          <a
            href="https://botchain.ai"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-xl bg-[#14161b] px-4 py-3 ring-1 ring-white/10 transition-opacity hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/botchain-logo.png" alt="BOT Chain" width={110} height={24} className="h-6 w-auto" />
          </a>
          <ul className="mt-4 space-y-1.5 font-mono text-[13px] text-ink-soft">
            <li>
              <a href="https://botchain.ai" target="_blank" rel="noreferrer" className="hover:text-primary">
                https://botchain.ai
              </a>
            </li>
            <li>
              <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer" className="hover:text-primary">
                https://scan.botchain.ai
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1200px] px-4 py-5 text-[13px] text-muted sm:px-6">
          EscrowAgent never holds your keys. Funds sit in a public contract and move only by the rules written in it.
        </p>
      </div>
    </footer>
  );
}
