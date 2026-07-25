export type PortalRole = "OWNER" | "ADMIN" | "MANAGER" | "USER";
export type PortalUserStatus = "ACTIVE" | "DISABLED";
export type VatStatus = "NOT_REGISTERED" | "PENDING" | "REGISTERED";
export type MerchantApplicationStatus = "NOT_INSTALLED" | "INSTALLED";
export type HQType = "EDGE" | "AFFILIATE";
export type HQRole = "ADMIN" | "OPERATOR";
export type MerchantStatus = "PROVISIONING" | "READY";
export type HQAccessMode = "SUPPORT_READ_ONLY" | "EDGE_FULL_ACCESS";
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
  legalName: string | null;
  supportEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  countryCode: string;
  vatStatus: VatStatus;
  vatNumber: string | null;
  portalUrl: string | null;
  status: MerchantStatus;
  timezone: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
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

export type MerchantUserRecord = {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  role: PortalRole;
  isActive: boolean;
  isPrimaryOwner: boolean;
  lastActiveAt: Date | null;
  createdAt: Date;
};

export type PortalUserInvitationRecord = {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: PortalRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type MerchantApplicationRecord = {
  id: string;
  businessId: string;
  slug: string;
  name: string;
  summary: string;
  status: MerchantApplicationStatus;
  launchUrl: string | null;
  installedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
  username: string;
  name: string;
  passwordHash: string;
  mfaSecretCiphertext: string | null;
  mfaEnabledAt: Date | null;
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
  user: Omit<HQUserRecord, "passwordHash" | "mfaSecretCiphertext">;
};

export type HQMfaChallengeRecord = {
  tokenHash: string;
  attempts: number;
  expiresAt: Date;
  membership: HQMembershipRecord;
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
    username: string;
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
    username: string;
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

export type EdgePortalContext = {
  kind: "EDGE";
  sessionId: string;
  expiresAt: Date;
  role: "EDGE";
  membershipId: null;
  user: {
    id: string;
    username: string;
    name: string;
    status: "ACTIVE";
  };
  business: BusinessRecord;
  support: {
    hqId: string;
    hqName: string;
    accessMode: "EDGE_FULL_ACCESS";
    ticketIssuedAt: Date;
    auditIdentifier: string;
  };
};

export type PortalContext =
  | MerchantPortalContext
  | HQSupportPortalContext
  | EdgePortalContext;

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
  operatorUsername: string;
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
  operatorUsername: string;
  createdAt: Date;
};
