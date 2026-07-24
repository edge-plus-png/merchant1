import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canAccessArea } from "@/lib/auth/authorization";
import { requirePortalContext } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";

export const metadata: Metadata = { title: "Users" };

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export default async function UsersPage() {
  const context = await requirePortalContext();

  if (!canAccessArea(context.role, "USERS")) {
    redirect("/portal?denied=users");
  }

  const memberships = await getPortalStore().listMemberships(context.business.id);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <h1>Users</h1>
        <p>Portal accounts for {context.business.name}.</p>
      </section>
      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((membership) => (
              <tr key={membership.id}>
                <td data-label="Name">{membership.user.name}</td>
                <td data-label="Email">{membership.user.email}</td>
                <td data-label="Role">{formatRole(membership.role)}</td>
                <td data-label="Status">
                  {membership.isActive && membership.user.status === "ACTIVE"
                    ? "Active"
                    : "Disabled"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
