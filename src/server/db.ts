import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'
import { withOptimize } from "@prisma/extension-optimize";

import { env } from "@/env";

// const createPrismaClient = () =>
//   new PrismaClient({
//     log:
//       env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
//   }).$extends(withAccelerate()).$extends(withOptimize({ apiKey: process.env.OPTIMIZE_API_KEY! }));
const createPrismaClient = () => {
  let client = new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }).$extends(withAccelerate());

  if (env.NODE_ENV === "development") {
    client = client.$extends(
      withOptimize({ apiKey: process.env.OPTIMIZE_API_KEY! })
    );
  }

  return client;
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
