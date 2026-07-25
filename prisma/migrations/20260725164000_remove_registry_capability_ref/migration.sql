-- PortalCapabilityAccess already stores the application slug. The former
-- registry reference duplicated that identity and referred to a concept that
-- no longer exists. Preserve one row per membership/application before making
-- the real key explicit.
WITH ranked_access AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "membershipId", "capabilitySlug"
      ORDER BY "createdAt", "id"
    ) AS duplicate_rank
  FROM "PortalCapabilityAccess"
)
DELETE FROM "PortalCapabilityAccess"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_access
  WHERE duplicate_rank > 1
);

DROP INDEX "PortalCapabilityAccess_membershipId_registryCapabilityRef_key";

ALTER TABLE "PortalCapabilityAccess"
  DROP COLUMN "registryCapabilityRef";

CREATE UNIQUE INDEX "PortalCapabilityAccess_membershipId_capabilitySlug_key"
  ON "PortalCapabilityAccess"("membershipId", "capabilitySlug");
