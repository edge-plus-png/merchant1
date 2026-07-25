import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "App access" };

export default function AppAccessPage() {
  return <PlaceholderPage category="Settings" title="App access" />;
}
