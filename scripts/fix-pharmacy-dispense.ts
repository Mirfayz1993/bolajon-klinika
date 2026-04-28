/**
 * Bir martalik: HEAD_DOCTOR uchun /pharmacy:dispense = true yangilash.
 *
 * Sprint 5'da `/pharmacy:dispense` mapping HEAD_DOCTOR'ni qo'shdi
 * (eski hardcode `[ADMIN, HEAD_DOCTOR, HEAD_NURSE, NURSE]` bilan parite),
 * lekin migration script faqat yo'q yozuvlarni yozadi — mavjud (canAccess=false) qoldi.
 * Bu fix.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.rolePermission.updateMany({
    where: { role: 'HEAD_DOCTOR', page: '/pharmacy:dispense' },
    data: { canAccess: true },
  });
  console.log(`Updated ${result.count} row(s) for HEAD_DOCTOR /pharmacy:dispense = true`);
}

main().finally(() => prisma.$disconnect());
