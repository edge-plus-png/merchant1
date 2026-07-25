-- Repair staging databases that received an early partial version of the HQ
-- merchant-access migration. Every statement is conditional so fresh databases
-- and databases with the complete migration remain unchanged.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MerchantStatus') THEN
    CREATE TYPE "MerchantStatus" AS ENUM ('PROVISIONING', 'READY');
  END IF;
END
$$;

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "status" "MerchantStatus" NOT NULL DEFAULT 'PROVISIONING';

CREATE TABLE IF NOT EXISTS "HQBusinessAssignment" (
  "id" TEXT NOT NULL,
  "hqId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "assignedBy" TEXT,

  CONSTRAINT "HQBusinessAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HQBusinessAssignment_businessId_removedAt_idx"
  ON "HQBusinessAssignment"("businessId", "removedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "HQBusinessAssignment_hqId_businessId_key"
  ON "HQBusinessAssignment"("hqId", "businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HQBusinessAssignment_hqId_fkey'
  ) THEN
    ALTER TABLE "HQBusinessAssignment"
      ADD CONSTRAINT "HQBusinessAssignment_hqId_fkey"
      FOREIGN KEY ("hqId") REFERENCES "HQ"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HQBusinessAssignment_businessId_fkey'
  ) THEN
    ALTER TABLE "HQBusinessAssignment"
      ADD CONSTRAINT "HQBusinessAssignment_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
