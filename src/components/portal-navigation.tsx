"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

const paymentItems = [
  { href: "/take-a-payment", label: "Take A Payment" },
  { href: "/link-management", label: "Link Management" },
  { href: "/reporting", label: "Reporting" },
];

const settingsItems = [
  { href: "/settings/status", label: "Status" },
  { href: "/settings/brand-checkout", label: "Brand & checkout" },
  { href: "/business", label: "Business profile" },
  { href: "/settings/merchant-controls", label: "Merchant controls" },
  { href: "/settings/app-access", label: "App access" },
  { href: "/settings/payment-fields", label: "Payment fields" },
  { href: "/settings/defined-fields", label: "Defined fields" },
  { href: "/settings/gateway-setup", label: "Gateway setup" },
];

function NavigationLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={active ? "drawer-link drawer-link-active" : "drawer-link"}
      href={href}
    >
      <span className="drawer-link-dot" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function PortalNavigation({
  businessName,
  environment,
  logoutAction,
  logoutLabel,
  role,
  userName,
}: {
  businessName: string;
  environment: string;
  logoutAction: string;
  logoutLabel: string;
  role: string;
  userName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    pathname === "/business" || pathname.startsWith("/settings/"),
  );

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <header className="portal-header">
        <div className="portal-header-business">
          <button
            aria-expanded={open}
            aria-label="Open navigation"
            className="menu-button"
            onClick={() => setOpen(true)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="business-identity">
            <strong>{businessName}</strong>
            <span>Merchant workspace <b>·</b> {environment}</span>
          </div>
        </div>
        <div className="account-identity">
          <span className="account-pill">
            <strong>{userName}</strong>
            <span>{role}</span>
          </span>
          <form action={logoutAction} method="post">
            <button className="sign-out-button" type="submit">
              {logoutLabel}
            </button>
          </form>
        </div>
      </header>

      {open ? (
        <div className="navigation-backdrop">
          <button
            aria-label="Close navigation"
            className="navigation-scrim"
            onClick={() => setOpen(false)}
            type="button"
          />
          <aside aria-label="Main navigation" className="navigation-drawer">
            <div className="drawer-brand-row">
              <div>
                <Logo destination="/home" />
                <p>{businessName}</p>
              </div>
              <button
                className="drawer-close-button"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <nav
              aria-label="Main navigation"
              className="drawer-navigation"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a")) setOpen(false);
              }}
            >
              <NavigationLink href="/home" label="Home" />

              <div className="drawer-group">
                <p className="drawer-group-label">Payments</p>
                {paymentItems.map((item) => (
                  <NavigationLink {...item} key={item.href} />
                ))}
              </div>

              <div className="drawer-group">
                <p className="drawer-group-label">My Apps</p>
                <NavigationLink href="/apps" label="My Apps" />
              </div>

              <div className="drawer-group">
                <p className="drawer-group-label">Manage</p>
                <NavigationLink href="/users" label="Users" />
                <div className="drawer-settings-row">
                  <button
                    aria-expanded={settingsOpen}
                    className="drawer-link drawer-link-button"
                    onClick={() => setSettingsOpen((value) => !value)}
                    type="button"
                  >
                    <span className="drawer-link-dot" aria-hidden="true" />
                    <span>Settings</span>
                  </button>
                  <button
                    aria-label={`${settingsOpen ? "Close" : "Open"} Settings menu`}
                    aria-expanded={settingsOpen}
                    className="settings-toggle"
                    onClick={() => setSettingsOpen((value) => !value)}
                    type="button"
                  >
                    {settingsOpen ? "−" : "+"}
                  </button>
                </div>
                {settingsOpen ? (
                  <div className="settings-links">
                    {settingsItems.map((item) => (
                      <Link
                        aria-current={pathname === item.href ? "page" : undefined}
                        className={
                          pathname === item.href
                            ? "settings-link settings-link-active"
                            : "settings-link"
                        }
                        href={item.href}
                        key={item.href}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </nav>
            <p className="drawer-environment">{environment}</p>
          </aside>
        </div>
      ) : null}
    </>
  );
}
