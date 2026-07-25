import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  return <PlaceholderPage category="Settings" title="Status" />;
}
