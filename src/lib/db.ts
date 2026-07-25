import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export function getDb() {
  prismaGlobal.prisma ??= new PrismaClient();
  return prismaGlobal.prisma;
}
