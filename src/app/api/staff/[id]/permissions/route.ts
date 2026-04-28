import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/staff/[id]/permissions
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAction('/staff:manage_permissions');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true },
    });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rolePerms = await prisma.rolePermission.findMany({ where: { role: user.role } });
    const roleMap: Record<string, boolean> = {};
    for (const p of rolePerms) roleMap[p.page] = p.canAccess;

    const userPerms = await prisma.userPermission.findMany({ where: { userId: id } });
    const userMap: Record<string, { canAccess: boolean; level: string }> = {};
    for (const p of userPerms) userMap[p.page] = { canAccess: p.canAccess, level: p.level };

    return NextResponse.json({ userId: user.id, name: user.name, role: user.role, roleMap, userMap });
  } catch (err) {
    console.error('[permissions GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/staff/[id]/permissions
export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireAction('/staff:manage_permissions');
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const body = await req.json();
  const { page, canAccess, level, clear } = body as {
    page: string;
    canAccess: boolean;
    level?: string;
    clear?: boolean;
  };

  if (!page) return NextResponse.json({ error: 'page required' }, { status: 400 });

  if (clear) {
    await prisma.userPermission.deleteMany({ where: { userId: id, page } });
    return NextResponse.json({ ok: true, cleared: true });
  }

  await prisma.userPermission.upsert({
    where: { userId_page: { userId: id, page } },
    create: { userId: id, page, canAccess, level: level ?? 'EDIT' },
    update: { canAccess, level: level ?? 'EDIT' },
  });

  return NextResponse.json({ ok: true });
}
