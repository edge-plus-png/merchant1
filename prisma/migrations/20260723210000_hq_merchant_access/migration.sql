-- CreateEnum
CREATE TYPE "HQType" AS ENUM ('EDGE', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "HQRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "HQAccessMode" AS ENUM ('SUPPORT_READ_ONLY');

-- CreateEnum
CREATE TYPE "HQAccessAuditAction" AS ENUM ('TICKET_ISSUED', 'SUPPORT_SESSION_CREATED');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('PROVISIONING', 'READY');

-- AlterTable
ALTER TABLE "Business"
ADD COLUMN "portalUrl" TEXT,
ADD COLUMN "status" "MerchantStatus" NOT NULL DEFAULT 'PROVISIONING';

-- CreateTable
CREATE TABLE "HQ" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HQType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HQUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "PortalUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HQUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HQMembership" (
    "id" TEXT NOT NULL,
    "hqId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "HQRole" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HQMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HQBusinessAssignment" (
    "id" TEXT NOT NULL,
    "hqId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "assignedBy" TEXT,

    CONSTRAINT "HQBusinessAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HQSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HQSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HQSupportSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "originHqId" TEXT NOT NULL,
    "originHqName" TEXT NOT NULL,
    "hqUserId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "operatorEmail" TEXT NOT NULL,
    "accessMode" "HQAccessMode" NOT NULL,
    "ticketIssuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "auditIdentifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HQSupportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HQAccessAuditEvent" (
    "id" TEXT NOT NULL,
    "auditIdentifier" TEXT NOT NULL,
    "action" "HQAccessAuditAction" NOT NULL,
    "businessId" TEXT NOT NULL,
    "originHqId" TEXT NOT NULL,
    "originHqName" TEXT NOT NULL,
    "hqUserId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "operatorEmail" TEXT NOT NULL,
    "accessMode" "HQAccessMode" NOT NULL,
    "ticketIssuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HQAccessAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HQAccessTicketNonce" (
    "nonce" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "auditIdentifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HQAccessTicketNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE UNIQUE INDEX "HQ_slug_key" ON "HQ"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HQUser_email_key" ON "HQUser"("email");

-- CreateIndex
CREATE INDEX "HQMembership_userId_isActive_idx" ON "HQMembership"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HQMembership_hqId_userId_key" ON "HQMembership"("hqId", "userId");

-- CreateIndex
CREATE INDEX "HQBusinessAssignment_businessId_removedAt_idx" ON "HQBusinessAssignment"("businessId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HQBusinessAssignment_hqId_businessId_key" ON "HQBusinessAssignment"("hqId", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "HQSession_tokenHash_key" ON "HQSession"("tokenHash");

-- CreateIndex
CREATE INDEX "HQSession_membershipId_idx" ON "HQSession"("membershipId");

-- CreateIndex
CREATE INDEX "HQSession_expiresAt_idx" ON "HQSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "HQSupportSession_tokenHash_key" ON "HQSupportSession"("tokenHash");

-- CreateIndex
CREATE INDEX "HQSupportSession_businessId_expiresAt_idx" ON "HQSupportSession"("businessId", "expiresAt");

-- CreateIndex
CREATE INDEX "HQSupportSession_auditIdentifier_idx" ON "HQSupportSession"("auditIdentifier");

-- CreateIndex
CREATE INDEX "HQAccessAuditEvent_auditIdentifier_createdAt_idx" ON "HQAccessAuditEvent"("auditIdentifier", "createdAt");

-- CreateIndex
CREATE INDEX "HQAccessAuditEvent_businessId_createdAt_idx" ON "HQAccessAuditEvent"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "HQAccessTicketNonce_expiresAt_idx" ON "HQAccessTicketNonce"("expiresAt");

-- CreateIndex
CREATE INDEX "HQAccessTicketNonce_businessId_consumedAt_idx" ON "HQAccessTicketNonce"("businessId", "consumedAt");

-- AddForeignKey
ALTER TABLE "HQMembership" ADD CONSTRAINT "HQMembership_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "HQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HQMembership" ADD CONSTRAINT "HQMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "HQUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HQBusinessAssignment" ADD CONSTRAINT "HQBusinessAssignment_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "HQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HQBusinessAssignment" ADD CONSTRAINT "HQBusinessAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HQSession" ADD CONSTRAINT "HQSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "HQMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HQSupportSession" ADD CONSTRAINT "HQSupportSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HQAccessAuditEvent" ADD CONSTRAINT "HQAccessAuditEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HQAccessTicketNonce" ADD CONSTRAINT "HQAccessTicketNonce_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
