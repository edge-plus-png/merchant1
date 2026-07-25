"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PortalRole } from "@/lib/portal-types";

type UserRow = {
  membershipId: string;
  name: string;
  email: string;
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
  role: PortalRole;
  expires: string;
};

const roleLabels: Record<PortalRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  USER: "User",
};

const roleDescriptions: Record<PortalRole, string> = {
  OWNER: "Full control of business information, users, and application access.",
  ADMIN: "Can manage business information and users.",
  MANAGER: "Can view the team, business information, and applications.",
  USER: "Standard view access to this merchant workspace.",
};

export function UserManagement({
  users,
  invitations,
  canManage,
  actorRole,
  businessName,
}: {
  users: UserRow[];
  invitations: InvitationRow[];
  canManage: boolean;
  actorRole: PortalRole | "HQ_SUPPORT";
  businessName: string;
}) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<PortalRole>("USER");
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [copied, setCopied] = useState(false);

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

  const activeCount = users.filter((user) => user.isActive).length;
  const elevatedCount = users.filter(
    (user) => user.isActive && (user.role === "OWNER" || user.role === "ADMIN"),
  ).length;
  const activeThisWeek = users.filter((user) => user.isActiveThisWeek).length;

  return (
    <div className="legacy-user-management">
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
                    value === "OWNER" && actorRole !== "OWNER" ? null : (
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
                {canManage ? <th scope="col">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const ownerChangeAllowed =
                  actorRole === "OWNER" && !user.isPrimaryOwner;
                const roleReadOnly =
                  user.isPrimaryOwner ||
                  (user.role === "OWNER" && actorRole !== "OWNER");

                return (
                  <tr key={user.membershipId}>
                    <td data-label="User">
                      <div className="legacy-user-cell">
                        <strong>{user.name}</strong>
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
                    {canManage ? (
                      <td data-label="Actions">
                        {user.isPrimaryOwner ? (
                          <span className="protected-copy">Protected</span>
                        ) : (
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
                        )}
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
                  {canManage ? (
                    <td data-label="Actions">
                      <form
                        action={`/api/portal/users/invitations/${invitation.id}`}
                        method="post"
                      >
                        <button className="table-action-button" type="submit">
                          Revoke
                        </button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
              {users.length === 0 && invitations.length === 0 ? (
                <tr>
                  <td className="empty-table-cell" colSpan={canManage ? 6 : 5}>
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
