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
    return NextResponse.json({ allowedPages: MANAGED_PAGES.map((p) => p.path) });
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
  const userMap = new Map(userPerms.map((p) => [p.page, p.canAccess]));

  const allowedPages = allPaths.filter((path) => {
    // UserPermission ustunlik qiladi
    if (userMap.has(path)) return userMap.get(path);
    // RolePermission
    if (roleMap.has(path)) return roleMap.get(path);
    // Default: ruxsat yo'q
    return false;
  });

  return NextResponse.json({ allowedPages });
}
