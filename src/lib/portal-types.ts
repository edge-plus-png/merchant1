export type PortalRole = "OWNER" | "ADMIN" | "MEMBER" | "LITE";
export type PortalUserStatus = "ACTIVE" | "DISABLED";

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

export type PortalContext = {
  sessionId: string;
  expiresAt: Date;
  role: PortalRole;
  membershipId: string;
  user: Omit<PortalUserRecord, "passwordHash">;
  business: BusinessRecord;
};
