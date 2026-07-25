import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { getMoveApplicationOrigin } from "../src/lib/env";

const prisma = new PrismaClient();

const merchantBootstrapSchema = z.object({
  businessId: z.string().min(1).optional(),
  businessName: z.string().min(2),
  businessSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  portalUrl: z.string().url(),
});

async function seedMerchantDirectoryRecord() {
  const moveApplicationOrigin = getMoveApplicationOrigin();
  const input = merchantBootstrapSchema.parse({
    businessId: process.env.PORTAL_BOOTSTRAP_BUSINESS_ID,
    businessName: process.env.PORTAL_BOOTSTRAP_BUSINESS_NAME,
    businessSlug: process.env.PORTAL_BOOTSTRAP_BUSINESS_SLUG,
    portalUrl: process.env.PORTAL_CANONICAL_URL,
  });

  const business = await prisma.business.upsert({
    where: { slug: input.businessSlug },
    update: { name: input.businessName, portalUrl: input.portalUrl },
    create: {
      id: input.businessId,
      slug: input.businessSlug,
      name: input.businessName,
      portalUrl: input.portalUrl,
    },
  });

  await prisma.merchantApplication.upsert({
    where: {
      businessId_slug: {
        businessId: business.id,
        slug: "move",
      },
    },
    update: {
      name: "Move",
      summary: "Manage your Move access for this business.",
      launchUrl: moveApplicationOrigin,
    },
    create: {
      businessId: business.id,
      slug: "move",
      name: "Move",
      summary: "Manage your Move access for this business.",
      status: "NOT_INSTALLED",
      launchUrl: moveApplicationOrigin,
    },
  });
}

async function main() {
  if (process.env.PORTAL_SURFACE === "HQ") {
    // HQ intentionally starts empty so /setup can create the one master account.
    return;
  }

  await seedMerchantDirectoryRecord();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
