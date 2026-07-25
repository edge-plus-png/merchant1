-- Replace the legacy merchant roles with the four roles exposed by Merchant Portal.
CREATE TYPE "PortalRole_new" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'USER');

ALTER TABLE "BusinessMembership"
  ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "BusinessMembership"
  ALTER COLUMN "role" TYPE "PortalRole_new"
  USING (
    CASE "role"::text
      WHEN 'MEMBER' THEN 'USER'
      WHEN 'LITE' THEN 'USER'
      ELSE "role"::text
    END
  )::"PortalRole_new";

ALTER TYPE "PortalRole" RENAME TO "PortalRole_old";
ALTER TYPE "PortalRole_new" RENAME TO "PortalRole";
DROP TYPE "PortalRole_old";

ALTER TABLE "BusinessMembership"
  ALTER COLUMN "role" SET DEFAULT 'USER';

-- Business information owned by Merchant Portal.
CREATE TYPE "VatStatus" AS ENUM ('NOT_REGISTERED', 'PENDING', 'REGISTERED');

ALTER TABLE "Business"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "supportEmail" TEXT,
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "addressLine1" TEXT,
  ADD COLUMN "addressLine2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "county" TEXT,
  ADD COLUMN "postcode" TEXT,
  ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'GB',
  ADD COLUMN "vatStatus" "VatStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
  ADD COLUMN "vatNumber" TEXT;

-- Expiring, revocable invitations for merchant user onboarding.
CREATE TABLE "PortalUserInvitation" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "invitedByMembershipId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "PortalRole" NOT NULL DEFAULT 'USER',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PortalUserInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalUserInvitation_tokenHash_key"
  ON "PortalUserInvitation"("tokenHash");
CREATE INDEX "PortalUserInvitation_businessId_createdAt_idx"
  ON "PortalUserInvitation"("businessId", "createdAt");
CREATE INDEX "PortalUserInvitation_businessId_email_idx"
  ON "PortalUserInvitation"("businessId", "email");
CREATE INDEX "PortalUserInvitation_expiresAt_idx"
  ON "PortalUserInvitation"("expiresAt");

ALTER TABLE "PortalUserInvitation"
  ADD CONSTRAINT "PortalUserInvitation_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortalUserInvitation"
  ADD CONSTRAINT "PortalUserInvitation_invitedByMembershipId_fkey"
  FOREIGN KEY ("invitedByMembershipId") REFERENCES "BusinessMembership"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Merchant-local application connection state. The page renders these rows
-- generically; the seed creates only Move for this milestone.
CREATE TYPE "MerchantApplicationStatus" AS ENUM ('NOT_INSTALLED', 'INSTALLED');

CREATE TABLE "MerchantApplication" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "MerchantApplicationStatus" NOT NULL DEFAULT 'NOT_INSTALLED',
  "launchUrl" TEXT,
  "installedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MerchantApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantApplication_businessId_slug_key"
  ON "MerchantApplication"("businessId", "slug");
CREATE INDEX "MerchantApplication_businessId_status_idx"
  ON "MerchantApplication"("businessId", "status");

ALTER TABLE "MerchantApplication"
  ADD CONSTRAINT "MerchantApplication_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MerchantApplication" (
  "id",
  "businessId",
  "slug",
  "name",
  "summary",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'move_' || "id",
  "id",
  'move',
  'Move',
  'Manage your Move access for this business.',
  'NOT_INSTALLED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Business"
ON CONFLICT ("businessId", "slug") DO NOTHING;
