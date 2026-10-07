"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isMainnet } from "@/lib/chain";
import { BlockPill } from "./BlockPill";
import { Logo } from "./Logo";
import { ThemeToggle } from "./Theme";
import { WalletButton } from "./Wallet";

const LINKS = [
  { href: "/", label: "New deal" },
  { href: "/deals", label: "My deals" },
];

function NavLinks({ path }: { path: string | null }) {
  return LINKS.map((l) => {
    const active = path !== null && (l.href === "/" ? path === "/" : path.startsWith(l.href));
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`relative py-1 text-[15px] transition-colors ${active ? "text-ink" : "text-muted hover:text-ink"}`}
      >
        {l.label}
        {active && <span className="absolute inset-x-0 -bottom-[7px] h-[2px] rounded-full bg-primary" />}
      </Link>
    );
  });
}

function CurrentNav() {
  return <NavLinks path={usePathname()} />;
}

/** The pathname is only known per request on deal pages, so the links stream in with their active state. */
function Nav() {
  return (
    <Suspense fallback={<NavLinks path={null} />}>
      <CurrentNav />
    </Suspense>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-page/90 backdrop-blur-md">
      {!isMainnet && (
        <div className="bg-sky-soft py-1.5 text-center text-[13px] text-primary-deep">
          You&apos;re on BOT Chain testnet. Tokens here have no value.
        </div>
      )}
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          <Nav />
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden lg:block">
            <BlockPill />
          </div>
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
      <nav className="flex gap-6 px-4 pb-3 md:hidden">
        <Nav />
      </nav>
    </header>
  );
}
