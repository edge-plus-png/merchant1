CREATE TABLE "ApplicationReturnStateNonce" (
  "id" TEXT NOT NULL,
  "nonce" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationReturnStateNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationReturnStateNonce_nonce_key"
  ON "ApplicationReturnStateNonce"("nonce");

CREATE INDEX "ApplicationReturnStateNonce_expiresAt_idx"
  ON "ApplicationReturnStateNonce"("expiresAt");
