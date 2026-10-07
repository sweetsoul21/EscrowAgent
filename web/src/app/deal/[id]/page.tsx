import { Suspense } from "react";
import type { Metadata } from "next";
import { DealSkeleton, DealView } from "@/components/DealView";

export const metadata: Metadata = {
  title: "Deal",
  description: "USDT is locked in escrow for this trade. Open it to accept, track or release the deal.",
};

export default function DealPage() {
  return (
    <Suspense fallback={<DealSkeleton />}>
      <DealView />
    </Suspense>
  );
}
