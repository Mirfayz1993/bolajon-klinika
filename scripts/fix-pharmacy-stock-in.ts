/**
 * Bir martalik: NURSE uchun /pharmacy:create = true yangilash.
 *
 * Sprint 6 Bughunter findings — STOCK_IN regressiya tuzatish:
 * Eski hardcode `WRITE_ROLES = [ADMIN, HEAD_NURSE, NURSE]` da NURSE
 * STOCK_IN qila olardi. Action-level permission'larga o'tishda
 * `/pharmacy:create = [ADMIN, HEAD_NURSE]` deb yozildi — NURSE yo'qoldi.
 *
 * `seed-permissions.ts` mapping kengaytirildi, lekin migration script
 * faqat yo'q yozuvlarni yozadi — mavjud (canAccess=false) qoldi. Bu fix.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.rolePermission.updateMany({
    where: { role: 'NURSE', page: '/pharmacy:create' },
    data: { canAccess: true },
  });
  console.log(`NURSE /pharmacy:create: updated ${result.count}`);
}

main().finally(() => prisma.$disconnect());
