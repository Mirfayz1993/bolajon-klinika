import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MANAGED_PAGES } from '@/config/nav-pages';

// GET /api/permissions/my — joriy foydalanuvchi uchun ruxsat berilgan sahifalar ro'yxati
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: userId, role } = session.user;

  // ADMIN hamma sahifaga kira oladi
  if (role === 'ADMIN') {
    const allPaths = MANAGED_PAGES.map((p) => p.path);
    const permissions = allPaths.map((page) => ({ page, level: 'EDIT' }));
    return NextResponse.json({ permissions, allowedPages: allPaths });
  }

  const allPaths = MANAGED_PAGES.map((p) => p.path);

  // Rol bo'yicha ruxsatlar
  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: role as never, page: { in: allPaths } },
  });
  const roleMap = new Map(rolePerms.map((p) => [p.page, p.canAccess]));

  // Foydalanuvchi bo'yicha individual ruxsatlar
  const userPerms = await prisma.userPermission.findMany({
    where: { userId, page: { in: allPaths } },
  });
  const userMap = new Map(userPerms.map((p) => [p.page, { canAccess: p.canAccess, level: p.level }]));

  const permissions: { page: string; level: string }[] = [];
  const allowedPages: string[] = [];

  for (const path of allPaths) {
    const userEntry = userMap.get(path);
    if (userEntry !== undefined) {
      // UserPermission ustunlik qiladi
      if (userEntry.canAccess) {
        permissions.push({ page: path, level: userEntry.level });
        allowedPages.push(path);
      }
    } else if (roleMap.has(path)) {
      // RolePermission
      if (roleMap.get(path)) {
        permissions.push({ page: path, level: 'EDIT' });
        allowedPages.push(path);
      }
    }
    // Default: ruxsat yo'q
  }

  return NextResponse.json({ permissions, allowedPages });
}
