import { redirect } from "next/navigation";
import { getPortalContext } from "@/lib/auth/session";
import { getHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { getPortalSurface } from "@/lib/surface";

export default async function HomePage() {
  const surface = await getPortalSurface();

  if (surface === "HQ") {
    if (!(await getHQStore().isSetupComplete())) {
      redirect("/setup");
    }

    redirect((await getHQContext()) ? "/dashboard" : "/login");
  }

  redirect((await getPortalContext()) ? "/dashboard" : "/login");
}
