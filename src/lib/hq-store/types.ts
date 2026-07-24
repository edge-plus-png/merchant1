import type {
  BusinessRecord,
  HQAccessAuditRecord,
  HQAccessMode,
  HQMerchantStatusAuditRecord,
  HQMembershipRecord,
  HQSessionRecord,
  HQType,
  MerchantStatus,
} from "@/lib/portal-types";

export type RecordHQTicketIssuedInput = {
  auditIdentifier: string;
  businessId: string;
  originHqId: string;
  originHqName: string;
  hqUserId: string;
  operatorName: string;
  operatorEmail: string;
  accessMode: HQAccessMode;
  ticketIssuedAt: Date;
  expiresAt: Date;
};

export type CreateEdgeMasterInput = {
  companyName: string;
  masterName: string;
  email: string;
  passwordHash: string;
};

export type CreateMerchantInput = {
  name: string;
  slug: string;
  portalUrl: string | null;
  status: MerchantStatus;
};

export type ChangeMerchantStatusInput = {
  businessId: string;
  newStatus: MerchantStatus;
  hqId: string;
  hqUserId: string;
  operatorName: string;
  operatorEmail: string;
};

export interface HQStore {
  isSetupComplete(): Promise<boolean>;
  createEdgeMaster(
    input: CreateEdgeMasterInput,
  ): Promise<{ status: "created"; membership: HQMembershipRecord } | { status: "already_setup" }>;
  findLoginMembership(email: string): Promise<HQMembershipRecord | null>;
  createSession(input: {
    membershipId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  findSession(tokenHash: string): Promise<HQSessionRecord | null>;
  listVisibleBusinesses(
    hqId: string,
    hqType: HQType,
  ): Promise<BusinessRecord[]>;
  findVisibleBusiness(
    businessId: string,
    hqId: string,
    hqType: HQType,
  ): Promise<BusinessRecord | null>;
  createMerchant(input: CreateMerchantInput): Promise<BusinessRecord>;
  changeMerchantStatus(
    input: ChangeMerchantStatusInput,
  ): Promise<
    | {
        status: "changed";
        business: BusinessRecord;
        audit: HQMerchantStatusAuditRecord;
      }
    | { status: "unchanged"; business: BusinessRecord }
    | { status: "not_found" }
  >;
  recordTicketIssued(input: RecordHQTicketIssuedInput): Promise<void>;
  listAuditEvents(hqId: string, hqType: HQType): Promise<HQAccessAuditRecord[]>;
}
