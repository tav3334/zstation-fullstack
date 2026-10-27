import { PrismaClient, Prisma } from '@prisma/client';

// Une seule instance par process (évite d'ouvrir de nouvelles connexions à chaque
// rechargement en dev et à chaque invocation "warm" en serverless).
// Le mot de passe et le remember_token ne sortent jamais par défaut (équivalent du $hidden Laravel).
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    omit: { user: { password: true, remember_token: true, pin_hash: true } },
  });

if (!globalForPrisma.__prisma) globalForPrisma.__prisma = prisma;

export { Prisma };
