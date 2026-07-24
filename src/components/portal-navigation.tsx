"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import type { PortalArea } from "@/lib/auth/authorization";

const items: Record<
  PortalArea,
  { href: string; label: string; icon: "overview" | "users" | "settings" | "apps" }
> = {
  OVERVIEW: { href: "/portal", label: "Overview", icon: "overview" },
  USERS: { href: "/portal/users", label: "Users", icon: "users" },
  SETTINGS: { href: "/portal/settings", label: "Settings", icon: "settings" },
  APPS: { href: "/portal/apps", label: "Apps", icon: "apps" },
};

export function PortalNavigation({ areas }: { areas: PortalArea[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal navigation" className="portal-navigation">
      {areas.map((area) => {
        const item = items[area];
        const active =
          item.href === "/portal"
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
