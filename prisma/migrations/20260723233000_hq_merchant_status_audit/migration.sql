-- CreateTable
CREATE TABLE "HQMerchantStatusAuditEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "previousStatus" "MerchantStatus" NOT NULL,
    "newStatus" "MerchantStatus" NOT NULL,
    "hqId" TEXT NOT NULL,
    "hqUserId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "operatorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HQMerchantStatusAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HQMerchantStatusAuditEvent_businessId_createdAt_idx"
ON "HQMerchantStatusAuditEvent"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "HQMerchantStatusAuditEvent_hqId_createdAt_idx"
ON "HQMerchantStatusAuditEvent"("hqId", "createdAt");

-- AddForeignKey
ALTER TABLE "HQMerchantStatusAuditEvent"
ADD CONSTRAINT "HQMerchantStatusAuditEvent_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
