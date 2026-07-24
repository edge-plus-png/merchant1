import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const merchantBootstrapSchema = z.object({
  businessId: z.string().min(1).optional(),
  businessName: z.string().min(2),
  businessSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  portalUrl: z.string().url(),
});

async function seedMerchantDirectoryRecord() {
  const input = merchantBootstrapSchema.parse({
    businessId: process.env.PORTAL_BOOTSTRAP_BUSINESS_ID,
    businessName: process.env.PORTAL_BOOTSTRAP_BUSINESS_NAME,
    businessSlug: process.env.PORTAL_BOOTSTRAP_BUSINESS_SLUG,
    portalUrl: process.env.PORTAL_CANONICAL_URL,
  });

  await prisma.business.upsert({
    where: { slug: input.businessSlug },
    update: { name: input.businessName, portalUrl: input.portalUrl },
    create: {
      id: input.businessId,
      slug: input.businessSlug,
      name: input.businessName,
      portalUrl: input.portalUrl,
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
