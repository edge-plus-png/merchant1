-- HQ operators authenticate with usernames rather than email addresses.
-- Keep the legacy email column nullable during the rollout so the currently
-- deployed version and this version can both operate while Vercel switches
-- traffic. A later cleanup migration can remove the compatibility columns.
ALTER TABLE "HQUser"
ADD COLUMN "username" TEXT;

UPDATE "HQUser"
SET "username" = LOWER("email")
WHERE "username" IS NULL;

ALTER TABLE "HQUser"
ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "HQUser_username_key" ON "HQUser"("username");

-- TOTP secrets are encrypted by the application before persistence. The fields
-- remain nullable so an existing pre-MFA deployment can migrate safely; the HQ
-- authentication layer rejects accounts until enrolment has completed.
ALTER TABLE "HQUser"
ADD COLUMN "mfaSecretCiphertext" TEXT,
ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);

ALTER TABLE "HQSupportSession"
ADD COLUMN "operatorUsername" TEXT;

UPDATE "HQSupportSession"
SET "operatorUsername" = "operatorEmail"
WHERE "operatorUsername" IS NULL;

ALTER TABLE "HQSupportSession"
ALTER COLUMN "operatorEmail" DROP NOT NULL;

ALTER TABLE "HQAccessAuditEvent"
ADD COLUMN "operatorUsername" TEXT;

UPDATE "HQAccessAuditEvent"
SET "operatorUsername" = "operatorEmail"
WHERE "operatorUsername" IS NULL;

ALTER TABLE "HQAccessAuditEvent"
ALTER COLUMN "operatorEmail" DROP NOT NULL;

ALTER TABLE "HQMerchantStatusAuditEvent"
ADD COLUMN "operatorUsername" TEXT;

UPDATE "HQMerchantStatusAuditEvent"
SET "operatorUsername" = "operatorEmail"
WHERE "operatorUsername" IS NULL;

ALTER TABLE "HQMerchantStatusAuditEvent"
ALTER COLUMN "operatorEmail" DROP NOT NULL;

CREATE TABLE "HQMfaChallenge" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HQMfaChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HQMfaChallenge_tokenHash_key" ON "HQMfaChallenge"("tokenHash");
CREATE INDEX "HQMfaChallenge_membershipId_idx" ON "HQMfaChallenge"("membershipId");
CREATE INDEX "HQMfaChallenge_expiresAt_idx" ON "HQMfaChallenge"("expiresAt");

ALTER TABLE "HQMfaChallenge"
ADD CONSTRAINT "HQMfaChallenge_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "HQMembership"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
