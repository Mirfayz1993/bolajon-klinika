/**
 * Bir martalik: HEAD_DOCTOR uchun /payments:see_all = true yangilash.
 *
 * Sprint 2'da `/payments:see_all` mapping HEAD_DOCTOR'ni qo'shdi (eski READ_ROLES'ga mos),
 * lekin migration script faqat yo'q yozuvlarni yozadi — mavjud (canAccess=false) qoldi.
 * Bu fix.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.rolePermission.updateMany({
    where: { role: 'HEAD_DOCTOR', page: '/payments:see_all' },
    data: { canAccess: true },
  });
  console.log(`Updated ${result.count} row(s) for HEAD_DOCTOR /payments:see_all = true`);
}

main().finally(() => prisma.$disconnect());
