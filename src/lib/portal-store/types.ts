import type {
  BusinessRecord,
  HQAccessAuditRecord,
  HQAccessMode,
  HQSupportSessionRecord,
  MerchantApplicationRecord,
  MerchantUserRecord,
  MembershipRecord,
  PortalRole,
  PortalSessionRecord,
  PortalUserInvitationRecord,
  VatStatus,
} from "@/lib/portal-types";
import type { PortalActorRole } from "@/lib/auth/authorization";

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

export type CleanupHQAccessRecordsInput = {
  supportSessionExpiresAt: Date;
  nonceConsumedBefore: Date;
};

export type CleanupHQAccessRecordsResult = {
  expiredSupportSessionsDeleted: number;
  oldConsumedNoncesDeleted: number;
};

export type UpdateBusinessInput = {
  businessId: string;
  name: string;
  legalName: string;
  supportEmail: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  countryCode: string;
  vatStatus: VatStatus;
  vatNumber: string | null;
  timezone: string;
  currency: string;
};

export type CreateInvitationInput = {
  businessId: string;
  invitedByMembershipId: string | null;
  name: string;
  email: string;
  role: PortalRole;
  tokenHash: string;
  expiresAt: Date;
};

export type MembershipMutationResult =
  | "updated"
  | "not_found"
  | "last_owner"
  | "primary_owner"
  | "owner_required"
  | "self";

export type MoveInstallationResult =
  | {
      status: "installed" | "already_installed";
      application: MerchantApplicationRecord;
    }
  | { status: "not_found" };

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
  cleanupHQAccessRecords(
    input: CleanupHQAccessRecordsInput,
  ): Promise<CleanupHQAccessRecordsResult>;
  listHQAccessAuditEvents(businessId: string): Promise<HQAccessAuditRecord[]>;
  updateBusiness(input: UpdateBusinessInput): Promise<BusinessRecord | null>;
  listMemberships(businessId: string): Promise<MerchantUserRecord[]>;
  listPendingInvitations(
    businessId: string,
  ): Promise<PortalUserInvitationRecord[]>;
  createInvitation(
    input: CreateInvitationInput,
  ): Promise<PortalUserInvitationRecord | "already_member" | "already_invited">;
  findInvitation(
    tokenHash: string,
  ): Promise<PortalUserInvitationRecord | null>;
  acceptInvitation(input: {
    tokenHash: string;
    passwordHash: string;
  }): Promise<"accepted" | "invalid" | "already_member">;
  revokeInvitation(input: {
    businessId: string;
    invitationId: string;
  }): Promise<boolean>;
  updateMembershipRole(input: {
    businessId: string;
    actorMembershipId: string | null;
    actorRole: PortalActorRole;
    membershipId: string;
    role: PortalRole;
  }): Promise<MembershipMutationResult>;
  setMembershipActive(input: {
    businessId: string;
    actorMembershipId: string | null;
    membershipId: string;
    isActive: boolean;
  }): Promise<MembershipMutationResult>;
  listApplications(businessId: string): Promise<MerchantApplicationRecord[]>;
  listApplicationAccessSlugs(
    businessId: string,
    membershipId: string,
  ): Promise<string[]>;
  installMove(
    businessId: string,
    trustedOrigin: string,
  ): Promise<MoveInstallationResult>;
}
