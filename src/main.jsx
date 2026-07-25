import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const MERCHANT_NAME = "Merchant 1";
const PROFILE_STORAGE_KEY = "edge-merchant-profile-v3";
const LEGACY_PROFILE_STORAGE_KEYS = ["edge-merchant-profile", "edge-merchant-profile-v2"];

const routeMap = {
  "/": { section: "Home", title: "Home" },
  "/dashboard": { section: "Home", title: "Home" },
  "/take-a-payment": { section: "Payments", title: "Take A Payment" },
  "/link-management": { section: "Payments", title: "Link Management" },
  "/reporting": { section: "Payments", title: "Reporting" },
  "/apps": { section: "My Apps", title: "My Apps" },
  "/users": { section: "Users", title: "Users" },
  "/settings/status": { section: "Settings", title: "Status" },
  "/settings/brand-checkout": { section: "Settings", title: "Brand & checkout" },
  "/settings/merchant-profile": { section: "Settings", title: "Business profile" },
  "/settings/merchant-controls": { section: "Settings", title: "Merchant controls" },
  "/settings/product-access": { section: "Settings", title: "App access" },
  "/settings/vt-fields": { section: "Settings", title: "VT fields" },
  "/settings/defined-fields": { section: "Settings", title: "Defined fields" },
  "/settings/gateway-setup": { section: "Settings", title: "Gateway setup" },
};

const navGroups = [
  {
    label: null,
    items: [{ label: "Home", path: "/" }],
  },
  {
    label: "Payments",
    items: [
      { label: "Take A Payment", path: "/take-a-payment" },
      { label: "Link Management", path: "/link-management" },
      { label: "Reporting", path: "/reporting" },
    ],
  },
  {
    label: "My Apps",
    items: [{ label: "My Apps", path: "/apps" }],
  },
  {
    label: "Manage",
    items: [
      { label: "Users", path: "/users" },
      { label: "Settings", path: "/settings/status", settings: true },
    ],
  },
];

const settingsItems = [
  { label: "Status", path: "/settings/status" },
  { label: "Brand & checkout", path: "/settings/brand-checkout" },
  { label: "Business profile", path: "/settings/merchant-profile" },
  { label: "Merchant controls", path: "/settings/merchant-controls" },
  { label: "App access", path: "/settings/product-access" },
  { label: "VT fields", path: "/settings/vt-fields" },
  { label: "Defined fields", path: "/settings/defined-fields" },
  { label: "Gateway setup", path: "/settings/gateway-setup" },
];

const initialUsers = [];

const securityActivity = [];

const profileSeed = {
  displayName: "",
  legalName: "",
  supportEmail: "",
  contactName: "",
  contactPhone: "",
  address1: "",
  address2: "",
  city: "",
  county: "",
  postcode: "",
  country: "",
  vatStatus: "",
  vatNumber: "",
  timezone: "",
  currency: "",
  settlementLabel: "",
  yearEnd: "",
  linkExpiry: "",
  reportingWindow: "",
  recipients: "",
};

function useRoute() {
  const readPath = () => (routeMap[window.location.pathname] ? window.location.pathname : "/");
  const [path, setPath] = useState(readPath);

  useEffect(() => {
    const handlePopState = () => setPath(readPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (nextPath) => {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return { path, route: routeMap[path], navigate };
}

function Brand() {
  return (
    <div className="brand-card">
      <img src="/branding/portal-app-black-bk.png" alt="Edge Portal" />
      <div className="brand-workspace">Merchant workspace</div>
    </div>
  );
}

function Sidebar({ path, navigate, settingsOpen, setSettingsOpen, mobileOpen, onClose }) {
  const handleNavigate = (nextPath) => {
    navigate(nextPath);
    onClose();
  };

  return (
    <>
      <button className={`nav-backdrop ${mobileOpen ? "visible" : ""}`} aria-label="Close navigation" onClick={onClose} />
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <button className="mobile-close" aria-label="Close navigation" onClick={onClose}>×</button>
        <Brand />
        <nav aria-label="Merchant navigation">
          {navGroups.map((group, groupIndex) => (
            <div className="nav-group" key={group.label || `primary-${groupIndex}`}>
              {group.label && <div className="nav-label">{group.label}</div>}
              {group.items.map((item) => {
                const isSettings = item.settings;
                const active = isSettings
                  ? path.startsWith("/settings/")
                  : path === item.path || (item.path === "/" && path === "/dashboard");
                return (
                  <React.Fragment key={item.path}>
                    <div className={`nav-row ${isSettings ? "with-toggle" : ""}`}>
                      <button className={`nav-link ${active ? "active" : ""}`} onClick={() => handleNavigate(item.path)}>
                        <span className="nav-dot" />
                        <span>{item.label}</span>
                      </button>
                      {isSettings && (
                        <button
                          className="settings-toggle"
                          aria-label={`${settingsOpen ? "Close" : "Open"} Settings menu`}
                          aria-expanded={settingsOpen}
                          onClick={() => setSettingsOpen((open) => !open)}
                        >
                          {settingsOpen ? "−" : "+"}
                        </button>
                      )}
                    </div>
                    {isSettings && settingsOpen && (
                      <div className="settings-subnav">
                        {settingsItems.map((setting) => (
                          <button
                            key={setting.path}
                            className={path === setting.path ? "selected" : ""}
                            onClick={() => handleNavigate(setting.path)}
                          >
                            {setting.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="environment-block">
          <div className="nav-label">Environment</div>
          <div className="environment-row"><span>Production</span><span>production</span></div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onOpen }) {
  return (
    <header className="topbar">
      <button className="mobile-menu" aria-label="Open navigation" onClick={onOpen}>
        <span /><span /><span />
      </button>
      <div className="workspace-title">
        <h1>{MERCHANT_NAME}</h1>
        <div>Merchant workspace <span>·</span> Production</div>
      </div>
      <div className="account">
        <div className="account-name"><strong>Merchant user</strong><span>Account</span></div>
        <button>Sign Out</button>
      </div>
    </header>
  );
}

function PageHeader({ eyebrow, title, description }) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function HomePage() {
  const days = [
    ["Sun", "£0.00", 0],
    ["Mon", "£0.00", 0],
    ["Tue", "£0.00", 0],
    ["Wed", "£0.00", 0],
    ["Thu", "£0.00", 0],
    ["Fri", "£0.00", 0],
    ["Sat", "£0.00", 0],
  ];
  return (
    <div className="home-stack">
      <section className="hero-metric panel">
        <div className="eyebrow blue">Today</div>
        <div className="hero-value">£0.00</div>
        <p>0 approved · 0 declined · +0% vs yesterday</p>
        <div className="metric-row">
          <MetricCard label="Yesterday" value="£0.00" detail="0 approved" />
          <MetricCard label="MTD" value="£0.00" detail="0 transactions" />
          <MetricCard label="YTD" value="£0.00" detail="0 approved" />
          <MetricCard label="Spend per customer" value="£0.00" detail="No approved customers" />
        </div>
      </section>
      <section className="panel trading-panel">
        <h3>Trading trend</h3>
        <p>Approved volume by day</p>
        <div className="chart" aria-label="Approved volume by day">
          {days.map(([day, value, height]) => (
            <div className="bar-column" key={day}>
              <div className="bar-track"><div className="bar" style={{ height: `${height}%` }} /></div>
              <strong>{day}</strong><span>{value}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel simple-panel">
        <div><h3>Transaction history</h3><p>Recent merchant activity will appear here.</p></div>
        <span className="status-chip">Setup pending</span>
      </section>
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <div className="eyebrow">{label}</div>
      <div className="metric-value">{value}</div>
      <p>{detail}</p>
    </article>
  );
}

function PlaceholderPage({ route, navigate }) {
  const isApps = route.title === "My Apps";
  return (
    <>
      <PageHeader eyebrow={route.section} title={route.title} description={isApps ? "Connect and manage the apps available to this merchant." : "This area is ready for the next phase of the merchant portal."} />
      <section className="panel placeholder-panel">
        <div className="placeholder-mark"><span /></div>
        <div>
          <h3>{isApps ? "Link my apps" : `${route.title} placeholder`}</h3>
          <p>{isApps ? "App connections will be managed here." : "The layout and navigation are in place; functional content can be connected here."}</p>
        </div>
        {isApps && <button className="primary-button" onClick={() => navigate("/apps")}>Link my apps</button>}
      </section>
    </>
  );
}

function StatCard({ label, value, detail }) {
  return <article className="stat-card"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function UsersPage() {
  const [users, setUsers] = useState(initialUsers);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);

  const activeCount = users.filter((user) => user.status === "Active").length;
  const elevatedCount = users.filter((user) => ["Owner", "Admin"].includes(user.role)).length;

  const updateUser = (id, patch) => setUsers((current) => current.map((user) => user.id === id ? { ...user, ...patch } : user));

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const handleInvite = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const user = {
      id: Date.now(),
      name: data.get("name"),
      username: data.get("username"),
      email: data.get("email"),
      merchant: MERCHANT_NAME,
      role: data.get("role"),
      status: "Invited",
      twoFactor: false,
      lastActive: "Invite pending",
    };
    setUsers((current) => [...current, user]);
    event.currentTarget.reset();
    showToast(`Invite created for ${user.name}.`);
  };

  const handleAction = (user, action) => {
    if (action === "Pause") {
      const next = user.status === "Paused" ? "Active" : "Paused";
      updateUser(user.id, { status: next });
      showToast(`${user.name} is now ${next.toLowerCase()}.`);
      return;
    }
    if (action === "2FA") {
      updateUser(user.id, { twoFactor: !user.twoFactor });
      showToast(`Two-factor authentication ${user.twoFactor ? "disabled" : "enabled"} for ${user.name}.`);
      return;
    }
    setModal({ user, action });
  };

  const submitModal = (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("value");
    if (modal.action === "Username") updateUser(modal.user.id, { username: value });
    if (modal.action === "Revoke") setUsers((current) => current.filter((user) => user.id !== modal.user.id));
    showToast(modal.action === "Password" ? `Password reset prepared for ${modal.user.name}.` : `${modal.action} updated for ${modal.user.name}.`);
    setModal(null);
  };

  return (
    <>
      <PageHeader eyebrow="Users" title="Users" />
      <div className="stats-grid">
        <StatCard label="Total users" value={users.length} detail="People with access to this merchant." />
        <StatCard label="Active users" value={activeCount} detail="Users who can currently sign in." />
        <StatCard label="Elevated access" value={elevatedCount} detail="Owner/Admin operators with control access." />
        <StatCard label="Active this week" value={activeCount} detail="Recent sign-in activity across the team." />
      </div>
      <section className="panel form-panel">
        <div className="section-title"><h3>Invite team member</h3><p>Send an invite link for this merchant workspace.</p></div>
        <form className="invite-form" onSubmit={handleInvite}>
          <Field label="Full name" name="name" required />
          <Field label="Username" name="username" required />
          <Field label="Email" name="email" type="email" required />
          <label className="field"><span>Merchant</span><select name="merchant" defaultValue={MERCHANT_NAME}><option>{MERCHANT_NAME}</option></select></label>
          <label className="field"><span>Role</span><select name="role" defaultValue="User">{["Owner", "Manager", "User", "Admin", "Lite terminal"].map((role) => <option key={role}>{role}</option>)}</select></label>
          <div className="role-note"><div className="eyebrow">Role</div><p>Payment task access for Take A Payment and Link Management.</p></div>
          <button className="primary-button" type="submit">Create invite</button>
        </form>
      </section>
      <section className="panel table-panel">
        <div className="section-title"><h3>Merchant team</h3><p>Review this merchant's team, roles, active access, and recent activity.</p></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>User</th><th>Merchant</th><th>Role</th><th>Status</th><th>2FA</th><th>Last active</th><th>Actions</th></tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan="7">No merchant users have been added.</td></tr>
              ) : users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong><span>@{user.username} · {user.email}</span></td>
                  <td>{user.merchant}</td>
                  <td><select aria-label={`${user.name} role`} value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value })}>{["Owner", "Manager", "User", "Admin", "Lite terminal"].map((role) => <option key={role}>{role}</option>)}</select></td>
                  <td><span className={`table-status ${user.status.toLowerCase()}`}>{user.status}</span></td>
                  <td><span className="table-status neutral">{user.twoFactor ? "Enabled" : "Disabled"}</span></td>
                  <td>{user.lastActive}</td>
                  <td><div className="table-actions">{["Username", "Password", user.status === "Paused" ? "Resume" : "Pause", "2FA", "Revoke"].map((action) => <button key={action} onClick={() => handleAction(user, action === "Resume" ? "Pause" : action)}>{action}</button>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="role-guidance"><div><div className="eyebrow">Control roles</div><p>Owner and Admin can manage users, settings, and access controls.</p></div><div><div className="eyebrow">Operational roles</div><p>Manager and User stay focused on payment operations and transaction work.</p></div></div>
      </section>
      <section className="panel table-panel">
        <div className="section-title"><h3>Security activity</h3><p>Recent login, 2FA, trusted-device, and password reset events.</p></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Time</th><th>User</th><th>Merchant</th><th>Event</th><th>IP</th></tr></thead>
            <tbody>
              {securityActivity.length === 0 ? (
                <tr><td colSpan="5">No security activity has been recorded.</td></tr>
              ) : securityActivity.map((activity) => (
                <tr key={activity.id}><td>{activity.time}</td><td>{activity.user}</td><td>{activity.merchant}</td><td>{activity.event}</td><td>{activity.ip}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
      {modal && <UserModal modal={modal} onClose={() => setModal(null)} onSubmit={submitModal} />}
    </>
  );
}

function UserModal({ modal, onClose, onSubmit }) {
  const isRevoke = modal.action === "Revoke";
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="user-action-title" onSubmit={onSubmit}>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="eyebrow">User access</div>
        <h3 id="user-action-title">{modal.action} · {modal.user.name}</h3>
        {isRevoke ? (
          <><p>This removes the user from the merchant workspace.</p><input type="hidden" name="value" value="revoke" /></>
        ) : (
          <Field label={modal.action === "Password" ? "Temporary password" : "New username"} name="value" type={modal.action === "Password" ? "password" : "text"} defaultValue={modal.action === "Username" ? modal.user.username : ""} required />
        )}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className={isRevoke ? "danger-button" : "primary-button"}>{isRevoke ? "Revoke access" : "Save change"}</button></div>
      </form>
    </div>
  );
}

function Field({ label, hint, name, type = "text", defaultValue, required = false }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} required={required} />{hint && <small>{hint}</small>}</label>;
}

function BusinessProfilePage() {
  const [profile, setProfile] = useState(() => {
    try { return { ...profileSeed, ...JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY)) }; }
    catch { return profileSeed; }
  });
  const [saved, setSaved] = useState(false);

  const setValue = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const save = (event) => {
    event.preventDefault();
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };
  const address = [profile.address1, profile.address2, profile.city, profile.county, profile.postcode, profile.country].filter(Boolean).join(", ");
  const vatLabel = { NOT_REGISTERED: "Not VAT registered", PENDING: "VAT registration pending", REGISTERED: "VAT registered" }[profile.vatStatus];

  return (
    <>
      <PageHeader eyebrow="Settings" title="Business profile" description="Business details and operational preferences." />
      <section className="panel profile-panel">
        <div className="section-title"><h3>Merchant Profile</h3><p>Keep the business identity, VAT position, and operational details shared across GetEdgePortal and enabled apps.</p></div>
        <div className="profile-summary">
          <Summary label="Organisation" value="" />
          <Summary label="Merchant display name" value={profile.displayName} />
          <Summary label="Legal name" value={profile.legalName} />
          <Summary label="Support email" value={profile.supportEmail} />
          <Summary label="Business address" value={address} />
          <Summary label="VAT status" value={vatLabel} />
          <Summary label="Currency" value={profile.currency} />
          <Summary label="Timezone" value={profile.timezone} />
        </div>
        <form className="profile-form" onSubmit={save}>
          <ProfileField label="Display name" value={profile.displayName} onChange={(value) => setValue("displayName", value)} />
          <ProfileField label="Legal name" value={profile.legalName} onChange={(value) => setValue("legalName", value)} />
          <ProfileField label="Support email" value={profile.supportEmail} onChange={(value) => setValue("supportEmail", value)} />
          <ProfileField label="Business contact name" value={profile.contactName} onChange={(value) => setValue("contactName", value)} />
          <ProfileField label="Business contact phone" value={profile.contactPhone} onChange={(value) => setValue("contactPhone", value)} />
          <ProfileField label="Address line 1" value={profile.address1} onChange={(value) => setValue("address1", value)} />
          <ProfileField label="Address line 2" value={profile.address2} onChange={(value) => setValue("address2", value)} />
          <ProfileField label="Town / city" value={profile.city} onChange={(value) => setValue("city", value)} />
          <ProfileField label="County" value={profile.county} onChange={(value) => setValue("county", value)} />
          <ProfileField label="Postcode" value={profile.postcode} onChange={(value) => setValue("postcode", value)} />
          <ProfileField label="Country code" value={profile.country} onChange={(value) => setValue("country", value)} hint="Two-letter ISO country code, for example GB." />
          <label className="field"><span>VAT status</span><select value={profile.vatStatus} onChange={(event) => setValue("vatStatus", event.target.value)}><option value="">Select VAT status</option><option value="NOT_REGISTERED">Not VAT registered</option><option value="PENDING">VAT registration pending</option><option value="REGISTERED">VAT registered</option></select></label>
          <ProfileField label="VAT number" value={profile.vatNumber} onChange={(value) => setValue("vatNumber", value)} />
          <ProfileField label="Timezone" value={profile.timezone} onChange={(value) => setValue("timezone", value)} />
          <ProfileField label="Currency" value={profile.currency} onChange={(value) => setValue("currency", value)} />
          <ProfileField label="Settlement account label" value={profile.settlementLabel} onChange={(value) => setValue("settlementLabel", value)} hint="Internal label shown in EP reporting. This does not change the gateway settlement account." />
          <ProfileField label="Business year end (MM-DD)" value={profile.yearEnd} onChange={(value) => setValue("yearEnd", value)} hint="Use MM-DD. Example: 03-31 for 31 March." />
          <ProfileField label="Payment link expiry (days)" type="number" value={profile.linkExpiry} onChange={(value) => setValue("linkExpiry", value)} />
          <ProfileField label="Reporting window (days)" type="number" value={profile.reportingWindow} onChange={(value) => setValue("reportingWindow", value)} />
          <ProfileField label="Operational / settlement receipt recipients" value={profile.recipients} onChange={(value) => setValue("recipients", value)} hint="Comma-separated email addresses for EP-side operational notifications. Gateway settlement receipt delivery still depends on gateway account notification setup." wide />
          <button className="primary-button save-profile" type="submit">Save Merchant Profile</button>
        </form>
      </section>
      {saved && <div className="toast" role="status">Merchant profile saved.</div>}
    </>
  );
}

function Summary({ label, value }) {
  return <article><div className="eyebrow">{label}</div><p>{value || "—"}</p></article>;
}

function ProfileField({ label, value, onChange, hint, type = "text", wide = false }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} />{hint && <small>{hint}</small>}</label>;
}

function App() {
  const { path, route, navigate } = useRoute();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(path.startsWith("/settings/"));

  useEffect(() => {
    if (path.startsWith("/settings/")) setSettingsOpen(true);
  }, [path]);

  useEffect(() => {
    LEGACY_PROFILE_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  }, []);

  const content = useMemo(() => {
    if (path === "/") return <HomePage />;
    if (path === "/users") return <UsersPage />;
    if (path === "/settings/merchant-profile") return <BusinessProfilePage />;
    return <PlaceholderPage route={route} navigate={navigate} />;
  }, [path, route]);

  return (
    <div className="app-shell">
      <Sidebar path={path} navigate={navigate} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="workspace">
        <Topbar onOpen={() => setMobileOpen(true)} />
        <main className={path === "/" ? "home-main" : ""}>{content}</main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
