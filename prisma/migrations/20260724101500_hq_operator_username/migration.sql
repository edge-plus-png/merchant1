-- HQ's existing access ticket identifies operators by username.
-- Retain the legacy email columns as nullable compatibility fields while
-- recording every new support session and audit event with the signed username.
ALTER TABLE "HQSupportSession"
ADD COLUMN "operatorUsername" TEXT NOT NULL,
ALTER COLUMN "operatorEmail" DROP NOT NULL;

ALTER TABLE "HQAccessAuditEvent"
ADD COLUMN "operatorUsername" TEXT NOT NULL,
ALTER COLUMN "operatorEmail" DROP NOT NULL;
