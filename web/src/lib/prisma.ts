import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured for Prisma runtime.");
  }

  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ["error"],
    });
  }

  return global.prisma;
}
