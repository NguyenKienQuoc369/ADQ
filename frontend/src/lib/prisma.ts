import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!global.prisma) {
    const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/adq_db";
    global.prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: ["error"],
    });
  }

  return global.prisma;
}
