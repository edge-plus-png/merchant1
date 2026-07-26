import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const merchantBootstrapSchema = z.object({
  businessId: z.string().min(1).optional(),
  businessName: z.string().min(2),
  businessSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  portalUrl: z.string().url(),
});

const exactHttpsOriginSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    value === url.origin
  );
}, "Capability origin must be an exact HTTPS origin.");

const capabilityRegistrySchema = z.array(
  z.object({
    slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/),
    name: z.string().min(1),
    summary: z.string().min(1),
    applicationOrigin: exactHttpsOriginSchema,
  }),
);

async function seedMerchantDirectoryRecord() {
  const capabilities = capabilityRegistrySchema.parse(
    JSON.parse(process.env.CAPABILITY_REGISTRY_JSON ?? "[]"),
  );
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

  for (const capability of capabilities) {
    await prisma.merchantApplication.upsert({
      where: {
        businessId_slug: {
          businessId: business.id,
          slug: capability.slug,
        },
      },
      update: {
        name: capability.name,
        summary: capability.summary,
        launchUrl: new URL(capability.applicationOrigin).origin,
      },
      create: {
        businessId: business.id,
        slug: capability.slug,
        name: capability.name,
        summary: capability.summary,
        status: "NOT_INSTALLED",
        launchUrl: new URL(capability.applicationOrigin).origin,
      },
    });
  }
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
