"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { Toaster } from "@/components/Toaster";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 3_000 } } })
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>
        <Toaster>{children}</Toaster>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
