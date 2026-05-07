import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';
import { invalidateUserPermissionsCache } from '@/lib/permissions';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/staff/[id]/permissions/batch
// Body: { permissions: { page: string; canAccess: boolean | null; level?: string }[] }
// canAccess = null → o'chirish (role defaultga qaytish)
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAction('/staff:manage_permissions');
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'Xodim topilmadi' }, { status: 404 });

  const body = await req.json() as {
    permissions: { page: string; canAccess: boolean | null; level?: string }[];
  };
  if (!Array.isArray(body.permissions)) {
    return NextResponse.json({ error: 'permissions array kerak' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const perm of body.permissions) {
        if (perm.canAccess === null) {
          // Override ni o'chir — role default kuchga kiradi
          await tx.userPermission.deleteMany({ where: { userId: id, page: perm.page } });
        } else {
          await tx.userPermission.upsert({
            where: { userId_page: { userId: id, page: perm.page } },
            create: { userId: id, page: perm.page, canAccess: perm.canAccess, level: perm.level ?? 'EDIT' },
            update: { canAccess: perm.canAccess, level: perm.level ?? 'EDIT' },
          });
        }
      }
    });

    invalidateUserPermissionsCache();

    return NextResponse.json({ ok: true, saved: body.permissions.length });
  } catch (err) {
    console.error('[permissions/batch POST]', err);
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
  }
}
