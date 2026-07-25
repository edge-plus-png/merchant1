import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Defined fields" };

export default function DefinedFieldsPage() {
  return <PlaceholderPage category="Settings" title="Defined fields" />;
}
