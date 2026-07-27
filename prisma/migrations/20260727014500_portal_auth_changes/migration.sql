ALTER TYPE "PortalRole" ADD VALUE IF NOT EXISTS 'LITE';

CREATE TYPE "PortalUserInvitationPurpose" AS ENUM ('INVITE', 'PASSWORD_RESET');
CREATE TYPE "PortalUserSecurityAuditAction" AS ENUM ('PASSWORD_RESET_REQUESTED');

ALTER TABLE "Business"
  ADD COLUMN "usernameLoginEnabledAt" TIMESTAMP(3);

ALTER TABLE "BusinessMembership"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "usernameNormalized" TEXT;

ALTER TABLE "PortalUserInvitation"
  ADD COLUMN "purpose" "PortalUserInvitationPurpose" NOT NULL DEFAULT 'INVITE',
  ADD COLUMN "username" TEXT,
  ADD COLUMN "usernameNormalized" TEXT,
  ADD COLUMN "targetMembershipId" TEXT,
  ADD COLUMN "requestedByKey" TEXT;

CREATE TABLE "PortalUserSecurityAuditEvent" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "actorMembershipId" TEXT NOT NULL,
  "targetMembershipId" TEXT NOT NULL,
  "action" "PortalUserSecurityAuditAction" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalUserSecurityAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessMembership_businessId_usernameNormalized_key"
  ON "BusinessMembership"("businessId", "usernameNormalized");
CREATE INDEX "PortalUserInvitation_businessId_purpose_createdAt_idx"
  ON "PortalUserInvitation"("businessId", "purpose", "createdAt");
CREATE INDEX "PortalUserInvitation_targetMembershipId_createdAt_idx"
  ON "PortalUserInvitation"("targetMembershipId", "createdAt");
CREATE INDEX "PortalUserInvitation_requestedByKey_createdAt_idx"
  ON "PortalUserInvitation"("requestedByKey", "createdAt");
CREATE INDEX "PortalUserSecurityAuditEvent_businessId_createdAt_idx"
  ON "PortalUserSecurityAuditEvent"("businessId", "createdAt");
CREATE INDEX "PortalUserSecurityAuditEvent_actorMembershipId_createdAt_idx"
  ON "PortalUserSecurityAuditEvent"("actorMembershipId", "createdAt");
CREATE INDEX "PortalUserSecurityAuditEvent_targetMembershipId_createdAt_idx"
  ON "PortalUserSecurityAuditEvent"("targetMembershipId", "createdAt");

ALTER TABLE "PortalUserInvitation"
  ADD CONSTRAINT "PortalUserInvitation_targetMembershipId_fkey"
  FOREIGN KEY ("targetMembershipId") REFERENCES "BusinessMembership"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortalUserSecurityAuditEvent"
  ADD CONSTRAINT "PortalUserSecurityAuditEvent_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
