import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <PlaceholderPage category="Home" title="Home" />;
}
