import { LogoMark } from "./Logo";

/** A drawn (not screenshotted) chat showing how a deal link lands in a conversation. */
export function ChatPreview() {
  return (
    <div className="theme-light relative mx-auto w-full max-w-[360px]">
      <div className="overflow-hidden rounded-[36px] border-[7px] border-ink bg-[#f3f1ec] shadow-[0_40px_80px_-40px_rgba(27,31,40,0.45)]">
        <div className="flex items-center gap-3 bg-white px-4 pt-5 pb-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-[#f4dcc4] text-sm font-semibold text-[#7a4a1d]">
            AO
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">Amaka · Gadgets Yaba</p>
            <p className="text-xs text-muted">online</p>
          </div>
        </div>

        <div className="space-y-2.5 px-3 py-4 text-[14px] leading-snug">
          <Bubble side="them" time="10:02">
            The controller is 45 USDT. Send and I&apos;ll dispatch today.
          </Bubble>
          <Bubble side="me" time="10:03">
            I&apos;ve been burnt before. I&apos;ll lock it on EscrowAgent instead. You get it once it reaches me.
          </Bubble>

          <div className="ml-auto w-[86%] rounded-2xl rounded-tr-md bg-[#dce7fb] p-1.5">
            <div className="rounded-xl bg-white p-3">
              <div className="flex items-center gap-2">
                <LogoMark className="size-5" />
                <span className="text-xs text-muted">escrowagent.vercel.app</span>
              </div>
              <p className="mt-2 text-[13px] text-muted">Deal #27</p>
              <p className="num text-[22px] leading-tight font-semibold tracking-[-0.01em]">45.00 USDT locked</p>
              <p className="mt-1 text-[13px] text-ink-soft">PS5 DualSense controller, white, sealed</p>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-sky-soft px-2.5 py-1.5">
                <span className="text-xs font-medium text-primary-deep">Waiting for seller</span>
                <span className="text-xs text-primary-deep">Accept →</span>
              </div>
            </div>
            <p className="px-2 pt-1 pb-0.5 text-right text-[10px] text-ink-soft/70">10:04</p>
          </div>

          <Bubble side="them" time="10:09">
            Seen it on-chain. Accepted. Rider leaves by 2.
          </Bubble>
        </div>
      </div>

      <div className="absolute top-[58%] -left-6 hidden rounded-2xl border border-line bg-white px-4 py-3 shadow-[0_18px_40px_-24px_rgba(27,31,40,0.4)] sm:block lg:-left-14">
        <p className="text-xs text-muted">Held in contract</p>
        <p className="num text-lg font-semibold">45.00 USDT</p>
      </div>
    </div>
  );
}

function Bubble({ side, time, children }: { side: "me" | "them"; time: string; children: React.ReactNode }) {
  const me = side === "me";
  return (
    <div
      className={`w-fit max-w-[82%] rounded-2xl px-3 pt-2 pb-1 ${
        me ? "ml-auto rounded-tr-md bg-[#dce7fb]" : "rounded-tl-md bg-white"
      }`}
    >
      {children}
      <span className="block pt-0.5 text-right text-[10px] text-ink-soft/70">{time}</span>
    </div>
  );
}
