import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Take A Payment" };

export default function TakeAPaymentPage() {
  return <PlaceholderPage category="Payments" title="Take A Payment" />;
}
