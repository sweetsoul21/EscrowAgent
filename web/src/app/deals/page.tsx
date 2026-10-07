import type { Metadata } from "next";
import { MyDeals } from "@/components/MyDeals";

export const metadata: Metadata = { title: "My deals" };

export default function DealsPage() {
  return <MyDeals />;
}
