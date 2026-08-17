import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!global.prisma) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL chưa được cấu hình cho Prisma. Hãy set DATABASE_URL trong biến môi trường.",
      );
    }
    global.prisma = new PrismaClient({
      log: ["error"],
    });
  }

  return global.prisma;
}
