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

  // Page-level + action-level paths (action format: `${page.path}:${action.key}`)
  const allPaths = [
    ...MANAGED_PAGES.map((p) => p.path),
    ...MANAGED_PAGES.flatMap((p) => (p.actions ?? []).map((a) => `${p.path}:${a.key}`)),
  ];

  // ADMIN hamma sahifaga va barcha action'larga kira oladi
  if (role === 'ADMIN') {
    const permissions = allPaths.map((page) => ({ page, level: 'EDIT' }));
    const actionMap: Record<string, boolean> = {};
    for (const path of allPaths) {
      if (path.includes(':')) actionMap[path] = true;
    }
    return NextResponse.json({ permissions, allowedPages: allPaths, actionMap });
  }

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
  const actionMap: Record<string, boolean> = {};

  for (const path of allPaths) {
    const isAction = path.includes(':');
    const userEntry = userMap.get(path);
    let granted = false;
    let level = 'EDIT';

    if (userEntry !== undefined) {
      // UserPermission ustunlik qiladi
      if (userEntry.canAccess) {
        granted = true;
        level = userEntry.level;
      }
    } else if (roleMap.has(path)) {
      // RolePermission
      if (roleMap.get(path)) {
        granted = true;
      }
    }

    if (granted) {
      permissions.push({ page: path, level });
      allowedPages.push(path);
      if (isAction) actionMap[path] = true;
    }
  }

  return NextResponse.json({ permissions, allowedPages, actionMap });
}
