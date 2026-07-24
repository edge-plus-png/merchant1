import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const bootstrapSchema = z.object({
  businessName: z.string().min(2),
  businessSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email().transform((value) => value.toLowerCase()),
  ownerPassword: z.string().min(12),
});

async function main() {
  const input = bootstrapSchema.parse({
    businessName: process.env.PORTAL_BOOTSTRAP_BUSINESS_NAME,
    businessSlug: process.env.PORTAL_BOOTSTRAP_BUSINESS_SLUG,
    ownerName: process.env.PORTAL_BOOTSTRAP_OWNER_NAME,
    ownerEmail: process.env.PORTAL_BOOTSTRAP_OWNER_EMAIL,
    ownerPassword: process.env.PORTAL_BOOTSTRAP_OWNER_PASSWORD,
  });

  const passwordHash = await hashPassword(input.ownerPassword);
  const business = await prisma.business.upsert({
    where: { slug: input.businessSlug },
    update: { name: input.businessName },
    create: { slug: input.businessSlug, name: input.businessName },
  });
  const owner = await prisma.portalUser.upsert({
    where: { email: input.ownerEmail },
    update: {
      name: input.ownerName,
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      email: input.ownerEmail,
      name: input.ownerName,
      passwordHash,
    },
  });

  await prisma.businessMembership.upsert({
    where: {
      businessId_userId: { businessId: business.id, userId: owner.id },
    },
    update: { role: "OWNER", isActive: true },
    create: {
      businessId: business.id,
      userId: owner.id,
      role: "OWNER",
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
