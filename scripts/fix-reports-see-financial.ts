/**
 * Bir martalik: HEAD_DOCTOR va HEAD_LAB_TECH uchun /reports:see_financial = true yangilash.
 *
 * Sprint 4'da `/reports:see_financial` mapping HEAD_DOCTOR va HEAD_LAB_TECH'ni qo'shdi
 * (eski `requireRole(['ADMIN', 'HEAD_DOCTOR', 'HEAD_LAB_TECH'])` xulqiga mos),
 * lekin migration script faqat yo'q yozuvlarni yozadi — mavjud (canAccess=false) qoldi.
 * Bu fix.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  for (const role of ['HEAD_DOCTOR', 'HEAD_LAB_TECH'] as const) {
    const r = await prisma.rolePermission.updateMany({
      where: { role, page: '/reports:see_financial' },
      data: { canAccess: true },
    });
    console.log(`${role}: updated ${r.count}`);
  }
}

main().finally(() => prisma.$disconnect());
