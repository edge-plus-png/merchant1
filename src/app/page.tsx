import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/auth/session";

export default async function HomePage() {
  const context = await getPortalContext();
  redirect(context ? "/portal" : "/login");
}
