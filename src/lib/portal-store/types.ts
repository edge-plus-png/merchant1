import type {
  HQAccessAuditRecord,
  HQAccessMode,
  HQSupportSessionRecord,
  MembershipRecord,
  PortalSessionRecord,
} from "@/lib/portal-types";

export type CreateHQSupportSessionInput = {
  tokenHash: string;
  nonce: string;
  businessId: string;
  originHqId: string;
  originHqName: string;
  hqUserId: string;
  operatorName: string;
  operatorUsername: string;
  accessMode: HQAccessMode;
  ticketIssuedAt: Date;
  ticketExpiresAt: Date;
  sessionExpiresAt: Date;
  auditIdentifier: string;
};

export interface PortalStore {
  findLoginMembership(
    email: string,
    businessId?: string,
  ): Promise<MembershipRecord | null>;
  createSession(input: {
    membershipId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  findSession(tokenHash: string): Promise<PortalSessionRecord | null>;
  findLocalBusiness(portalOrigin: string): Promise<MembershipRecord["business"] | null>;
  consumeTicketAndCreateSupportSession(
    input: CreateHQSupportSessionInput,
  ): Promise<"created" | "replayed" | "business_missing">;
  findSupportSession(
    tokenHash: string,
  ): Promise<HQSupportSessionRecord | null>;
  deleteSupportSession(tokenHash: string): Promise<void>;
  listHQAccessAuditEvents(businessId: string): Promise<HQAccessAuditRecord[]>;
}
