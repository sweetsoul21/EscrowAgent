import { Suspense } from "react";
import { BadgeCheck, Clock3, Handshake, Scale, Undo2, Wallet } from "lucide-react";
import { CreateDealForm, CreateDealSkeleton } from "@/components/CreateDeal";
import { ChatPreview } from "@/components/ChatPreview";
import { LiveNumbers, PayMeLink } from "@/components/HomeWidgets";

const STEPS = [
  {
    n: "01",
    title: "Buyer locks the USDT",
    body: "Paste the seller's address, the price and what you agreed. The money moves into the contract, not to a person.",
  },
  {
    n: "02",
    title: "Drop the link in the chat",
    body: "One tap shares it to WhatsApp or Telegram. The seller sees the money is really there before they lift a finger.",
  },
  {
    n: "03",
    title: "Seller accepts and delivers",
    body: "They accept, hand over the item or finish the job, then mark it delivered.",
  },
  {
    n: "04",
    title: "Buyer confirms, seller is paid",
    body: "Happy with it? Confirm and the USDT lands in the seller's wallet in seconds.",
  },
];

const EXITS = [
  {
    icon: BadgeCheck,
    title: "To the seller",
    body: "When the buyer confirms, or 3 days after delivery if the buyer goes silent and raises nothing.",
  },
  {
    icon: Undo2,
    title: "Back to the buyer",
    body: "If the seller declines, never accepts in time, refunds on their own, or both of you agree to cancel.",
  },
  {
    icon: Scale,
    title: "Split by the arbiter",
    body: "Only when one of you raises a dispute. The arbiter is fixed in the contract and can't trade here.",
  },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto grid max-w-[1200px] gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1fr_480px] lg:gap-16 lg:pt-20">
        <div className="lg:pt-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-blush px-3 py-1.5 text-[13px] font-medium text-ink-soft ring-1 ring-blush-line">
            <Handshake className="size-4 text-primary" />
            Escrow for WhatsApp and Telegram trades
          </p>
          <h1 className="mt-6 text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[60px] lg:text-[68px]">
            Who sends first?
            <br />
            <span className="text-primary">Neither of you.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[18px] leading-relaxed text-ink-soft">
            The buyer locks USDT on BOT Chain. The seller can see it&apos;s there. It only moves when the buyer says the
            goods arrived, so nobody has to trust a stranger&apos;s promise.
          </p>
          <ul className="mt-8 grid max-w-[34rem] gap-3 text-[15px] text-ink-soft sm:grid-cols-2">
            <li className="flex items-center gap-2.5">
              <Wallet className="size-[18px] text-primary" /> No sign-up. Just your wallet
            </li>
            <li className="flex items-center gap-2.5">
              <Clock3 className="size-[18px] text-primary" /> Deals from 0.10 USDT
            </li>
          </ul>
          <div className="mt-12 hidden lg:block">
            <ChatPreview />
          </div>
        </div>

        <div id="new" className="scroll-mt-28">
          <Suspense fallback={<CreateDealSkeleton />}>
            <CreateDealForm />
          </Suspense>
        </div>

        <div className="lg:hidden">
          <ChatPreview />
        </div>
      </section>

      <section className="border-y border-line bg-mist/60">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
          <h2 className="max-w-[18ch] text-[36px] leading-[1.08] font-semibold tracking-[-0.025em] sm:text-[44px]">
            A deal in four moves
          </h2>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-[var(--radius-card)] border border-blush-line bg-blush p-7">
                <span className="num font-mono text-sm text-primary">{s.n}</span>
                <h3 className="mt-8 text-[19px] leading-snug font-semibold">{s.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-[36px] leading-[1.08] font-semibold tracking-[-0.025em] sm:text-[44px]">
              Three ways out.
              <br />
              <span className="text-muted">No back door.</span>
            </h2>
            <p className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-ink-soft">
              Locked USDT can leave the contract in exactly three ways. There is no withdraw button for the team, and the
              fee for each deal is fixed the moment it&apos;s opened.
            </p>
          </div>
          <div className="grid gap-3">
            {EXITS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-5 rounded-[var(--radius-panel)] border border-line bg-paper p-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-[18px] font-semibold">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20">
          <h2 className="text-sm font-medium text-muted">Live from the contract</h2>
          <div className="mt-4">
            <LiveNumbers />
          </div>
        </div>

        <div className="mt-6">
          <PayMeLink />
        </div>
      </section>
    </>
  );
}
