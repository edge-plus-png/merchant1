import type { Metadata } from "next";
import { UserManagement } from "@/components/user-management";
import {
  canCompleteUsernameMigration,
  canManageUsers,
} from "@/lib/auth/authorization";
import { requirePortalContext } from "@/lib/auth/session";
import { suggestUsernames } from "@/lib/auth/username";
import { getPortalStore } from "@/lib/portal-store";

export const metadata: Metadata = { title: "Users" };

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
});

const errorMessages: Record<string, string> = {
  invalid: "That user change was not valid.",
  last_owner: "The business must always have an active Owner.",
  owner_required: "Only an Owner can assign or change the Owner role.",
  primary_owner: "The primary Owner is protected.",
  self: "You cannot deactivate your own account.",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const context = await requirePortalContext();
  const store = getPortalStore();
  const [users, invitations] = await Promise.all([
    store.listMemberships(context.business.id),
    store.listPendingInvitations(context.business.id),
  ]);
  const canManage = canManageUsers(context.role);
  const canMigrateUsernames = canCompleteUsernameMigration(context.role);
  const generatedUsernames = new Map(
    suggestUsernames(
      users
        .filter((user) => !user.username)
        .map((user) => ({ membershipId: user.membershipId, email: user.email })),
      [
        ...users.flatMap((user) => (user.username ? [user.username] : [])),
        ...invitations.flatMap((invitation) =>
          invitation.username ? [invitation.username] : [],
        ),
      ],
    ).map((item) => [item.membershipId, item.username]),
  );
  const { error, updated } = await searchParams;

  return (
    <div className="merchant-page users-page">
      <section className="page-heading merchant-page-heading">
        <p className="legacy-eyebrow">Users</p>
        <h1>Users</h1>
      </section>

      {context.kind === "HQ_SUPPORT" ? (
        <p className="read-only-notice" role="status">
          You are viewing users through read-only HQ-managed access.
        </p>
      ) : !canManage ? (
        <p className="read-only-notice" role="status">
          {context.role === "MANAGER"
            ? "You can create reset links for eligible users. Owners and Admins manage roles and invitations."
            : "An Owner or Admin can invite users and change access."}
        </p>
      ) : null}

      {updated ? (
        <p className="success-notice" role="status">
          User access updated.
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {errorMessages[error] ?? errorMessages.invalid}
        </p>
      ) : null}

      <UserManagement
        actorRole={context.role}
        businessName={context.business.name}
        canManage={canManage}
        canMigrateUsernames={canMigrateUsernames}
        invitations={invitations.map((invitation) => ({
          id: invitation.id,
          name: invitation.name,
          email: invitation.email,
          username: invitation.username ?? null,
          role: invitation.role,
          expires: dateFormatter.format(invitation.expiresAt),
        }))}
        users={users.map((user) => ({
          membershipId: user.membershipId,
          name: user.name,
          email: user.email,
          username: user.username ?? null,
          role: user.role,
          isActive: user.isActive,
          isActiveThisWeek: Boolean(user.lastActiveAt),
          isPrimaryOwner: user.isPrimaryOwner,
          lastActive: user.lastActiveAt
            ? dateTimeFormatter.format(user.lastActiveAt)
            : "Not yet",
        }))}
        usernameLoginEnabled={Boolean(context.business.usernameLoginEnabledAt)}
        usernameLoginEnabledAt={
          context.business.usernameLoginEnabledAt
            ? dateTimeFormatter.format(context.business.usernameLoginEnabledAt)
            : null
        }
        usernameSuggestions={users.map((user) => ({
          membershipId: user.membershipId,
          username: user.username ?? generatedUsernames.get(user.membershipId) ?? "",
        }))}
      />
    </div>
  );
}
