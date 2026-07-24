import type {
  MembershipRecord,
  PortalSessionRecord,
} from "@/lib/portal-types";

export interface PortalStore {
  findLoginMembership(email: string): Promise<MembershipRecord | null>;
  createSession(input: {
    membershipId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  findSession(tokenHash: string): Promise<PortalSessionRecord | null>;
  listMemberships(businessId: string): Promise<MembershipRecord[]>;
}
