/**
 * Bir martalik: Sprint 5 regressiyalarini tuzatish.
 *
 * REGRESSIYA #1 — HEAD_NURSE admission'ni tahrirlay olmasdi.
 *   Eski xulq: requireRole(['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE']) ruxsat berardi.
 *   Yangi: requireAnyAction('/admissions:edit_rate', '/admissions:create')
 *          mapping'ida HEAD_NURSE yo'q edi. Endi qo'shildi.
 *
 * REGRESSIYA #2 — NURSE/HEAD_NURSE ambulatory QR skanerni ko'ra olmasdi.
 *   Eski xulq: CAN_MANAGE = [ADMIN, HEAD_DOCTOR, HEAD_NURSE, NURSE, RECEPTIONIST].
 *   Yangi: /ambulatory:create mapping'ida NURSE va HEAD_NURSE yo'q edi. Endi qo'shildi.
 *
 * Seed migration script faqat yo'q yozuvlarni yozadi — mavjud (canAccess=false)
 * yozuvlar qoladi. Bu fix shu mavjud yozuvlarni canAccess=true ga yangilaydi.
 */
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updates: Array<{ role: Role; page: string }> = [
    { role: 'HEAD_NURSE', page: '/admissions:create' },
    { role: 'HEAD_NURSE', page: '/ambulatory:create' },
    { role: 'NURSE', page: '/ambulatory:create' },
    { role: 'NURSE', page: '/ambulatory:discharge' },
    { role: 'RECEPTIONIST', page: '/ambulatory:discharge' },
    { role: 'DOCTOR', page: '/tasks:create' },
    { role: 'HEAD_NURSE', page: '/admissions:discharge' },
  ];
  for (const u of updates) {
    const r = await prisma.rolePermission.updateMany({
      where: { role: u.role, page: u.page },
      data: { canAccess: true },
    });
    console.log(`${u.role} ${u.page}: updated ${r.count}`);
  }
}

main().finally(() => prisma.$disconnect());
