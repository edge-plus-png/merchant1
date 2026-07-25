import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "My Apps" };

export default function AppsPage() {
  return <PlaceholderPage category="My Apps" title="My Apps" />;
}
