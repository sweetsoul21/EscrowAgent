import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "EscrowAgent: safe USDT deals for WhatsApp and Telegram trades", template: "%s · EscrowAgent" },
  description:
    "Lock USDT on BOT Chain, share one link in your chat, and release it only when the goods arrive. Escrow for P2P trades between people who don't know each other.",
  openGraph: {
    title: "EscrowAgent",
    description: "Neither of you has to send first. USDT escrow on BOT Chain for chat trades.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The inline theme script adds `dark` to <html> before hydration, hence suppressHydrationWarning.
    <html lang="en" className={`${hanken.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
