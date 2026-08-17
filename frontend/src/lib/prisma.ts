import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL chưa được cấu hình cho Prisma. Hãy tạo `frontend/.env.local` và set `DATABASE_URL` (Supabase Postgres), sau đó restart `npm run dev`.",
    );
  }

  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ["error"],
    });
  }

  return global.prisma;
}
