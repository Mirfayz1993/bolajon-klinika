/**
 * Sprint 13 oldidan: hozirgi RolePermission va UserPermission yozuvlarini
 * JSON faylga eksport qilish (rollback uchun xavfsizlik nusxa).
 */
import { PrismaClient } from '@prisma/client';
import { writeFile } from 'fs/promises';

const prisma = new PrismaClient();

async function main() {
  const rolePerms = await prisma.rolePermission.findMany({ orderBy: [{ role: 'asc' }, { page: 'asc' }] });
  const userPerms = await prisma.userPermission.findMany({ orderBy: [{ userId: 'asc' }, { page: 'asc' }] });

  const backup = {
    timestamp: new Date().toISOString(),
    rolePermissions: rolePerms,
    userPermissions: userPerms,
    counts: {
      role: rolePerms.length,
      user: userPerms.length,
    },
  };

  const path = `permissions-backup-${Date.now()}.json`;
  await writeFile(path, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`Backup saved: ${path}`);
  console.log(`  RolePermissions: ${rolePerms.length}`);
  console.log(`  UserPermissions: ${userPerms.length}`);
}

main().finally(() => prisma.$disconnect());
