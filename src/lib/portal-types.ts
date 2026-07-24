export type PortalRole = "OWNER" | "ADMIN" | "MEMBER" | "LITE";
export type PortalUserStatus = "ACTIVE" | "DISABLED";
export type HQType = "EDGE" | "AFFILIATE";
export type HQRole = "ADMIN" | "OPERATOR";
export type MerchantStatus = "PROVISIONING" | "READY";
export type HQAccessMode = "SUPPORT_READ_ONLY";
export type HQAccessAuditAction =
  | "TICKET_ISSUED"
  | "SUPPORT_SESSION_CREATED";

export type PortalUserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  status: PortalUserStatus;
};

export type BusinessRecord = {
  id: string;
  slug: string;
  name: string;
  portalUrl: string | null;
  status: MerchantStatus;
  timezone: string;
  currency: string;
};

export type MembershipRecord = {
  id: string;
  role: PortalRole;
  isActive: boolean;
  user: PortalUserRecord;
  business: BusinessRecord;
};

export type PortalSessionRecord = {
  id: string;
  expiresAt: Date;
  membership: MembershipRecord;
};

export type MerchantPortalContext = {
  kind: "MERCHANT_USER";
  sessionId: string;
  expiresAt: Date;
  role: PortalRole;
  membershipId: string;
  user: Omit<PortalUserRecord, "passwordHash">;
  business: BusinessRecord;
};

export type HQRecord = {
  id: string;
  slug: string;
  name: string;
  type: HQType;
};

export type HQUserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  status: PortalUserStatus;
};

export type HQMembershipRecord = {
  id: string;
  role: HQRole;
  isActive: boolean;
  hq: HQRecord;
  user: HQUserRecord;
};

export type HQSessionRecord = {
  id: string;
  expiresAt: Date;
  membership: HQMembershipRecord;
};

export type HQContext = {
  sessionId: string;
  expiresAt: Date;
  role: HQRole;
  membershipId: string;
  hq: HQRecord;
  user: Omit<HQUserRecord, "passwordHash">;
};

export type HQSupportSessionRecord = {
  id: string;
  expiresAt: Date;
  ticketIssuedAt: Date;
  auditIdentifier: string;
  accessMode: HQAccessMode;
  business: BusinessRecord;
  operator: {
    hqId: string;
    hqName: string;
    userId: string;
    name: string;
    email: string;
  };
};

export type HQSupportPortalContext = {
  kind: "HQ_SUPPORT";
  sessionId: string;
  expiresAt: Date;
  role: "HQ_SUPPORT";
  membershipId: null;
  user: {
    id: string;
    email: string;
    name: string;
    status: "ACTIVE";
  };
  business: BusinessRecord;
  support: {
    hqId: string;
    hqName: string;
    accessMode: HQAccessMode;
    ticketIssuedAt: Date;
    auditIdentifier: string;
  };
};

export type PortalContext = MerchantPortalContext | HQSupportPortalContext;

export type HQAccessAuditRecord = {
  id: string;
  auditIdentifier: string;
  action: HQAccessAuditAction;
  businessId: string;
  businessName: string;
  originHqId: string;
  originHqName: string;
  hqUserId: string;
  operatorName: string;
  operatorEmail: string;
  accessMode: HQAccessMode;
  ticketIssuedAt: Date;
  expiresAt: Date;
  createdAt: Date;
};

export type HQMerchantStatusAuditRecord = {
  id: string;
  businessId: string;
  previousStatus: MerchantStatus;
  newStatus: MerchantStatus;
  hqId: string;
  hqUserId: string;
  operatorName: string;
  operatorEmail: string;
  createdAt: Date;
};
