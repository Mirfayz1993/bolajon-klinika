/**
 * Sprint 13: RolePermission → UserPermission migration.
 *
 * Maqsad: har bir aktiv hodim uchun, uning rol bo'yicha mavjud
 * RolePermission qiymatlarini UserPermission'ga shaxsiy yozuv qilib ko'chirish.
 *
 * Mantiq:
 * - ADMIN'larni o'tkazib yuboradi (kod tomonida bypass — DB yozuvi kerak emas)
 * - Faqat canAccess=true bo'lgan RolePermission yozuvlarini ko'chiradi
 * - Hodim uchun mavjud UserPermission'ga tegmaydi (skip)
 *
 * Idempotent — qayta-qayta ishga tushirsa, faqat YO'Q yozuvlarni qo'shadi.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
  });
  console.log(`Aktiv hodimlar: ${users.length}`);

  const rolePerms = await prisma.rolePermission.findMany({
    where: { canAccess: true },
  });
  console.log(`canAccess=true bo'lgan RolePermissions: ${rolePerms.length}`);

  const rolePermsByRole = new Map<string, typeof rolePerms>();
  for (const rp of rolePerms) {
    const arr = rolePermsByRole.get(rp.role) ?? [];
    arr.push(rp);
    rolePermsByRole.set(rp.role, arr);
  }

  let created = 0, skipped = 0, adminSkipped = 0;

  for (const user of users) {
    if (user.role === 'ADMIN') {
      adminSkipped++;
      continue;
    }

    const perms = rolePermsByRole.get(user.role) ?? [];
    if (perms.length === 0) {
      console.log(`  ${user.name} (${user.role}): rol uchun ruxsat yo'q, skip`);
      continue;
    }

    for (const rp of perms) {
      const existing = await prisma.userPermission.findUnique({
        where: { userId_page: { userId: user.id, page: rp.page } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.userPermission.create({
        data: {
          userId: user.id,
          page: rp.page,
          canAccess: true,
          level: 'EDIT',
        },
      });
      created++;
    }

    console.log(`  ${user.name} (${user.role}): ${perms.length} dan ko'chirildi`);
  }

  console.log('\n=== Yakun ===');
  console.log(`  Yaratildi: ${created}`);
  console.log(`  Mavjud edi (skipped): ${skipped}`);
  console.log(`  ADMIN o'tkazib yuborildi: ${adminSkipped}`);
}

main().finally(() => prisma.$disconnect());
