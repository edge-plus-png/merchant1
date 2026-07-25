import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Gateway setup" };

export default function GatewaySetupPage() {
  return <PlaceholderPage category="Settings" title="Gateway setup" />;
}
