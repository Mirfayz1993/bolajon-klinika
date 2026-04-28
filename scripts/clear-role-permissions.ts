/**
 * Sprint 13: RolePermission jadvalni butunlay tozalash.
 *
 * MUHIM: Avval `migrate-roles-to-user-permissions.ts` ishga tushirilgan bo'lishi
 * SHART. Aks holda hodimlar barcha ruxsatlaridan ayriladi.
 *
 * ADMIN bypass kod tomonida (`api-auth.ts` da `requireAction`/`requireAnyAction`)
 * saqlanadi — DB'da yozuv kerak emas.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.rolePermission.count();
  console.log(`RolePermission yozuvlari (oldin): ${before}`);

  const result = await prisma.rolePermission.deleteMany({});
  console.log(`O'chirildi: ${result.count}`);

  const after = await prisma.rolePermission.count();
  console.log(`RolePermission yozuvlari (keyin): ${after}`);
}

main().finally(() => prisma.$disconnect());
