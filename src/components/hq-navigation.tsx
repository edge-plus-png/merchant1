"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: "overview" as const },
  { href: "/merchants", label: "Merchants", icon: "business" as const },
];

export function HQNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="HQ navigation" className="portal-navigation hq-navigation">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "nav-link nav-link-active" : "nav-link"}
            href={item.href}
            key={item.href}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
