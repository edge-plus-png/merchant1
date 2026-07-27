"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  canResetPassword,
  type PortalActorRole,
} from "@/lib/auth/authorization";
import type { PortalRole } from "@/lib/portal-types";

type UserRow = {
  membershipId: string;
  name: string;
  email: string;
  username: string | null;
  role: PortalRole;
  isActive: boolean;
  isActiveThisWeek: boolean;
  isPrimaryOwner: boolean;
  lastActive: string;
};

type InvitationRow = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: PortalRole;
  expires: string;
};

const roleLabels: Record<PortalRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  USER: "User",
  LITE: "Lite",
};

const roleDescriptions: Record<PortalRole, string> = {
  OWNER: "Full control of business information, users, and application access.",
  ADMIN: "Can manage business information and users.",
  MANAGER: "Can view the team, business information, and applications.",
  USER: "Standard view access to this merchant workspace.",
  LITE: "Limited view access to this merchant workspace.",
};

export function UserManagement({
  users,
  invitations,
  canManage,
  actorRole,
  businessName,
  usernameLoginEnabled,
  usernameLoginEnabledAt,
  canMigrateUsernames,
  usernameSuggestions,
}: {
  users: UserRow[];
  invitations: InvitationRow[];
  canManage: boolean;
  actorRole: PortalActorRole;
  businessName: string;
  usernameLoginEnabled: boolean;
  usernameLoginEnabledAt: string | null;
  canMigrateUsernames: boolean;
  usernameSuggestions: Array<{ membershipId: string; username: string }>;
}) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<PortalRole>("USER");
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [resetTarget, setResetTarget] = useState("");
  const [resetError, setResetError] = useState("");
  const [resettingMembershipId, setResettingMembershipId] = useState("");
  const [migrationError, setMigrationError] = useState("");
  const [migrating, setMigrating] = useState(false);
  const usernameConfirmationDialog = useRef<HTMLDialogElement>(null);
  const [usernames, setUsernames] = useState<Record<string, string>>(
    Object.fromEntries(
      usernameSuggestions.map((item) => [item.membershipId, item.username]),
    ),
  );

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setInviteError("");
    setInvitationUrl("");

    const response = await fetch("/api/portal/users/invitations", {
      body: new FormData(form),
      method: "POST",
    });
    const result = (await response.json()) as {
      error?: string;
      invitationUrl?: string;
    };

    setSubmitting(false);

    if (!response.ok || !result.invitationUrl) {
      setInviteError(
        result.error ?? "The invitation could not be created. Try again.",
      );
      return;
    }

    setInvitationUrl(result.invitationUrl);
    form.reset();
    setSelectedRole("USER");
    router.refresh();
  }

  async function copyInvitation() {
    await navigator.clipboard.writeText(invitationUrl);
    setCopied(true);
  }

  async function createPasswordReset(user: UserRow) {
    setResetError("");
    setResetUrl("");
    setResetTarget("");
    setResettingMembershipId(user.membershipId);
    const fields = new FormData();
    fields.set("purpose", "PASSWORD_RESET");
    fields.set("membershipId", user.membershipId);
    const response = await fetch("/api/portal/users/invitations", {
      body: fields,
      method: "POST",
    });
    const result = (await response.json()) as { error?: string; resetUrl?: string };
    setResettingMembershipId("");
    if (!response.ok || !result.resetUrl) {
      setResetError(result.error ?? "The reset link could not be created.");
      return;
    }
    setResetUrl(result.resetUrl);
    setResetTarget(user.name);
  }

  async function copyResetLink() {
    await navigator.clipboard.writeText(resetUrl);
  }

  async function completeUsernameMigration() {
    setMigrating(true);
    setMigrationError("");
    const response = await fetch("/api/portal/users/usernames", {
      body: JSON.stringify({
        assignments: users.map((user) => ({
          membershipId: user.membershipId,
          username: usernames[user.membershipId] ?? "",
        })),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json()) as { error?: string };
    setMigrating(false);
    if (!response.ok) {
      usernameConfirmationDialog.current?.close();
      setMigrationError(result.error ?? "Username login could not be enabled.");
      return;
    }
    router.refresh();
  }

  function reviewUsernameMigration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    usernameConfirmationDialog.current?.showModal();
  }

  const activeCount = users.filter((user) => user.isActive).length;
  const elevatedCount = users.filter(
    (user) => user.isActive && (user.role === "OWNER" || user.role === "ADMIN"),
  ).length;
  const activeThisWeek = users.filter((user) => user.isActiveThisWeek).length;
  const showActions =
    canManage || users.some((user) => canResetPassword(actorRole, user.role));
  const validUsernameCount = users.filter((user) =>
    /^[A-Za-z0-9_-]{3,64}$/.test(usernames[user.membershipId] ?? ""),
  ).length;
  const allUsernamesReady = validUsernameCount === users.length && users.length > 0;

  return (
    <div className="legacy-user-management">
      {!usernameLoginEnabled && canMigrateUsernames ? (
        <section className="legacy-surface username-migration-panel">
          <div className="username-migration-heading">
            <div className="legacy-section-heading">
              <h2>Switch login from email to username</h2>
              <p>
                Review the login username for every user before making the switch.
              </p>
            </div>
            <div className="username-migration-progress" role="status">
              <strong>
                {validUsernameCount} of {users.length}
              </strong>
              <span>usernames ready</span>
            </div>
          </div>
          <form className="username-migration-form" onSubmit={reviewUsernameMigration}>
            {migrationError ? (
              <p className="form-error legacy-form-message" role="alert">
                {migrationError}
              </p>
            ) : null}
            <div className="username-migration-table" role="table">
              <div className="username-migration-table-header" role="row">
                <span role="columnheader">User</span>
                <span role="columnheader">Email address</span>
                <span role="columnheader">New login username</span>
              </div>
              {users.map((user) => (
                <div className="username-migration-row" key={user.membershipId} role="row">
                  <strong role="cell">{user.name}</strong>
                  <span className="username-migration-email" role="cell">
                    {user.email}
                  </span>
                  <label role="cell">
                    <span className="username-migration-mobile-label">
                      New login username
                    </span>
                    <input
                      aria-label={`Login username for ${user.name}`}
                      autoCapitalize="none"
                      autoComplete="off"
                      maxLength={64}
                      minLength={3}
                      onChange={(event) =>
                        setUsernames((current) => ({
                          ...current,
                          [user.membershipId]: event.target.value,
                        }))
                      }
                      pattern="[A-Za-z0-9_-]+"
                      required
                      value={usernames[user.membershipId] ?? ""}
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="username-migration-actions">
              <p>
                Usernames use 3–64 letters, numbers, underscores or hyphens.
              </p>
              <button
                className="merchant-primary-button"
                disabled={!allUsernamesReady || migrating}
                type="submit"
              >
                Confirm usernames and switch off email login
              </button>
            </div>
          </form>

          <dialog
            aria-labelledby="username-confirmation-title"
            className="username-confirmation-dialog"
            ref={usernameConfirmationDialog}
          >
            <div className="username-confirmation-content">
              <h2 id="username-confirmation-title">Switch to username login?</h2>
              <p>
                After this change, {users.length === 1 ? "this user must" : `all ${users.length} users must`} sign in with the usernames shown above. Email
                addresses will no longer work for login.
              </p>
              <p className="username-confirmation-warning">
                This change cannot be undone from the Portal.
              </p>
              <div className="username-confirmation-actions">
                <button
                  className="table-action-button"
                  disabled={migrating}
                  onClick={() => usernameConfirmationDialog.current?.close()}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="merchant-primary-button"
                  disabled={migrating}
                  onClick={completeUsernameMigration}
                  type="button"
                >
                  {migrating ? "Switching…" : "Confirm and switch login"}
                </button>
              </div>
            </div>
          </dialog>
        </section>
      ) : null}

      {usernameLoginEnabled ? (
        <section className="username-login-active" role="status">
          <span className="username-login-active-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <h2>Username login is active</h2>
            <p>
              {users.length === 1
                ? "This user signs in with a username."
                : `All ${users.length} current users sign in with usernames.`}{" "}
              Email addresses remain as contact information only.
            </p>
            {usernameLoginEnabledAt ? (
              <small>Enabled {usernameLoginEnabledAt}</small>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="user-summary" aria-label="User summary">
        <div>
          <span>Total users</span>
          <strong>{users.length}</strong>
          <p>People with access to this merchant.</p>
        </div>
        <div>
          <span>Active users</span>
          <strong>{activeCount}</strong>
          <p>Users who can currently sign in.</p>
        </div>
        <div>
          <span>Elevated access</span>
          <strong>{elevatedCount}</strong>
          <p>Owner/Admin operators with control access.</p>
        </div>
        <div>
          <span>Active this week</span>
          <strong>{activeThisWeek}</strong>
          <p>Recent sign-in activity across the team.</p>
        </div>
      </section>

      {canManage ? (
        <section className="legacy-surface invite-team-panel">
          <div className="legacy-section-heading">
            <h2>Invite team member</h2>
            <p>Send an invite link for this merchant workspace.</p>
          </div>
          <form className="legacy-invite-form" onSubmit={createInvitation}>
            {inviteError ? (
              <p className="form-error legacy-form-message" role="alert">
                {inviteError}
              </p>
            ) : null}
            <div className="legacy-invite-grid">
              <label>
                <span>Full name</span>
                <input autoComplete="name" maxLength={160} name="name" required />
              </label>
              <label>
                <span>Username</span>
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  maxLength={64}
                  minLength={3}
                  name="username"
                  pattern="[A-Za-z0-9_-]+"
                  required
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  autoComplete="email"
                  maxLength={254}
                  name="email"
                  required
                  type="email"
                />
              </label>
              <label>
                <span>Merchant</span>
                <select aria-label="Merchant" disabled value={businessName}>
                  <option>{businessName}</option>
                </select>
              </label>
              <label>
                <span>Role</span>
                <select
                  aria-label="Role"
                  name="role"
                  onChange={(event) =>
                    setSelectedRole(event.target.value as PortalRole)
                  }
                  value={selectedRole}
                >
                  {Object.entries(roleLabels).map(([value, label]) =>
                    value === "OWNER" &&
                    actorRole !== "OWNER" &&
                    actorRole !== "EDGE" ? null : (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="invite-role-row">
              <div className="role-description">
                <strong>{roleLabels[selectedRole]}</strong>
                <span>{roleDescriptions[selectedRole]}</span>
              </div>
              <button
                className="merchant-primary-button"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Creating…" : "Create invite"}
              </button>
            </div>
          </form>

          {invitationUrl ? (
            <div className="invitation-link-panel" role="status">
              <div>
                <strong>Invitation created</strong>
                <span>Share this secure, single-use link. It expires in seven days.</span>
              </div>
              <input aria-label="Invitation link" readOnly value={invitationUrl} />
              <button className="table-action-button" onClick={copyInvitation} type="button">
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : null}

        </section>
      ) : null}

      {resetError ? (
        <p className="form-error legacy-form-message" role="alert">
          {resetError}
        </p>
      ) : null}
      {resetUrl ? (
        <div className="invitation-link-panel password-reset-link-panel" role="status">
          <div>
            <strong>Password reset link for {resetTarget}</strong>
            <span>Share this secure, single-use link. It expires in 15 minutes.</span>
          </div>
          <input aria-label="Password reset link" readOnly value={resetUrl} />
          <button className="table-action-button" onClick={copyResetLink} type="button">
            Copy link
          </button>
        </div>
      ) : null}

      <section className="legacy-surface users-panel">
        <div className="legacy-section-heading">
          <h2>Merchant team</h2>
          <p>Review this merchant&apos;s team, roles, active access, and recent activity.</p>
        </div>

        <div className="merchant-table-frame">
          <table className="users-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Merchant</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Last active</th>
                {showActions ? <th scope="col">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const ownerChangeAllowed =
                  (actorRole === "OWNER" || actorRole === "EDGE") &&
                  !user.isPrimaryOwner;
                const roleReadOnly =
                  user.isPrimaryOwner ||
                  (user.role === "OWNER" &&
                    actorRole !== "OWNER" &&
                    actorRole !== "EDGE");

                return (
                  <tr key={user.membershipId}>
                    <td data-label="User">
                      <div className="legacy-user-cell">
                        <strong>{user.name}</strong>
                        {user.username ? (
                          <span className="user-login-identity">
                            <b>Username:</b> {user.username}
                          </span>
                        ) : null}
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td data-label="Merchant">{businessName}</td>
                    <td data-label="Role">
                      {canManage && !roleReadOnly ? (
                        <form
                          action={`/api/portal/users/${user.membershipId}`}
                          className="inline-role-form"
                          method="post"
                        >
                          <input name="action" type="hidden" value="role" />
                          <select
                            aria-label={`Role for ${user.name}`}
                            defaultValue={user.role}
                            name="role"
                          >
                            {Object.entries(roleLabels).map(([value, label]) =>
                              value === "OWNER" && !ownerChangeAllowed ? null : (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                          <button className="table-action-button" type="submit">
                            Save
                          </button>
                        </form>
                      ) : (
                        <span className={`role-badge role-${user.role.toLowerCase()}`}>
                          {roleLabels[user.role]}
                        </span>
                      )}
                    </td>
                    <td data-label="Status">
                      <span
                        className={
                          user.isActive
                            ? "status-badge status-active"
                            : "status-badge status-inactive"
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td data-label="Last active">{user.lastActive}</td>
                    {showActions ? (
                      <td data-label="Actions">
                        <div className="user-action-stack">
                          {canManage && !user.isPrimaryOwner ? (
                            <form
                              action={`/api/portal/users/${user.membershipId}`}
                              method="post"
                            >
                              <input name="action" type="hidden" value="active" />
                              <input
                                name="isActive"
                                type="hidden"
                                value={user.isActive ? "false" : "true"}
                              />
                              <button className="table-action-button" type="submit">
                                {user.isActive ? "Pause" : "Reactivate"}
                              </button>
                            </form>
                          ) : canManage ? (
                            <span className="protected-copy">Protected</span>
                          ) : null}
                          {canResetPassword(actorRole, user.role) ? (
                            <button
                              className="table-action-button"
                              disabled={resettingMembershipId === user.membershipId}
                              onClick={() => createPasswordReset(user)}
                              type="button"
                            >
                              {resettingMembershipId === user.membershipId
                                ? "Creating…"
                                : "Reset password"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td data-label="User">
                    <div className="legacy-user-cell">
                      <strong>{invitation.name}</strong>
                      {invitation.username ? (
                        <span className="user-login-identity">
                          <b>Username:</b> {invitation.username}
                        </span>
                      ) : null}
                      <span>{invitation.email}</span>
                    </div>
                  </td>
                  <td data-label="Merchant">{businessName}</td>
                  <td data-label="Role">
                    <span className={`role-badge role-${invitation.role.toLowerCase()}`}>
                      {roleLabels[invitation.role]}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span className="status-badge status-pending">Invited</span>
                  </td>
                  <td data-label="Last active">Expires {invitation.expires}</td>
                  {showActions ? (
                    <td data-label="Actions">
                      {canManage ? (
                        <form
                          action={`/api/portal/users/invitations/${invitation.id}`}
                          method="post"
                        >
                          <button className="table-action-button" type="submit">
                            Revoke
                          </button>
                        </form>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
              {users.length === 0 && invitations.length === 0 ? (
                <tr>
                  <td
                    className="empty-table-cell"
                    colSpan={showActions ? 6 : 5}
                  >
                    No merchant users have been added yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="role-guidance">
          <div>
            <strong>Control roles</strong>
            <span>Owner and Admin can manage users, settings, and access controls.</span>
          </div>
          <div>
            <strong>Operational roles</strong>
            <span>Manager and User stay focused on everyday merchant operations.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
