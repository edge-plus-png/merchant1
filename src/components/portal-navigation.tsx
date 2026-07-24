"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import type { PortalArea } from "@/lib/auth/authorization";

const items: Record<
  PortalArea,
  { href: string; label: string; icon: "overview" }
> = {
  DASHBOARD: { href: "/dashboard", label: "Dashboard", icon: "overview" },
};

export function PortalNavigation({ areas }: { areas: PortalArea[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal navigation" className="portal-navigation">
      {areas.map((area) => {
        const item = items[area];
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "nav-link nav-link-active" : "nav-link"}
            href={item.href}
            key={area}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
