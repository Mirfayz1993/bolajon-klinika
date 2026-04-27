/**
 * Action-level RolePermission migration (bir martalik production migration).
 *
 * Bu skript faqat YO'Q yozuvlar uchun yozadi — admin tomonidan qo'lda
 * o'zgartirilgan mavjud `RolePermission` qatorlariga **TEGMAYDI**.
 *
 * - Idempotent: re-run safe.
 * - Mavjud yozuvlar `skipped` sifatida sanaladi.
 * - Yo'q yozuvlar default `ACTION_ACCESS` qiymatiga muvofiq yaratiladi.
 *
 * Foydalanish:
 *   npx tsx scripts/migrate-action-permissions.ts
 */

import { PrismaClient, Role } from '@prisma/client';
import { ACTION_ACCESS } from '../prisma/seed-permissions';

const prisma = new PrismaClient();

const ALL_ROLES: Role[] = [
  'ADMIN',
  'HEAD_DOCTOR',
  'DOCTOR',
  'HEAD_NURSE',
  'NURSE',
  'HEAD_LAB_TECH',
  'LAB_TECH',
  'RECEPTIONIST',
  'SPEECH_THERAPIST',
  'MASSAGE_THERAPIST',
  'SANITARY_WORKER',
  'PHARMACIST',
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const [page, allowedRoles] of Object.entries(ACTION_ACCESS)) {
    for (const role of ALL_ROLES) {
      const existing = await prisma.rolePermission.findUnique({
        where: { role_page: { role, page } },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const canAccess = allowedRoles.includes(role);
      await prisma.rolePermission.create({
        data: { role, page, canAccess },
      });
      created++;
    }
  }

  console.log(`Migration tugadi: ${created} yangi, ${skipped} mavjud (tegilmadi)`);
}

main()
  .catch((err) => {
    console.error('Migration xatosi:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
