import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { invalidatePermissionsCache } from '@/lib/permissions';
import { requireRole, ROLE_GROUPS } from '@/lib/api-auth';

// GET /api/permissions — barcha RolePermission yozuvlarini qaytaradi (faqat ADMIN)
export async function GET() {
  const auth = await requireRole(ROLE_GROUPS.ADMIN_ONLY);
  if (!auth.ok) return auth.response;

  try {
    const data = await prisma.rolePermission.findMany({
      orderBy: [{ page: 'asc' }, { role: 'asc' }],
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('GET /api/permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/permissions — ruxsatni yangilash (faqat ADMIN)
export async function PUT(req: NextRequest) {
  const auth = await requireRole(ROLE_GROUPS.ADMIN_ONLY);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { role, page, canAccess } = body as {
      role: string;
      page: string;
      canAccess: boolean;
    };

    // Validatsiya
    if (!role || !page || typeof canAccess !== 'boolean') {
      return NextResponse.json(
        { error: 'role, page va canAccess (boolean) majburiy' },
        { status: 400 }
      );
    }

    if (!Object.values(Role).includes(role as Role)) {
      return NextResponse.json({ error: 'Noto\'g\'ri rol' }, { status: 400 });
    }

    const updated = await prisma.rolePermission.upsert({
      where: { role_page: { role: role as Role, page } },
      update: { canAccess },
      create: { role: role as Role, page, canAccess },
    });

    // Cache ni tozala — yangi ruxsat darhol kuchga kirsin
    invalidatePermissionsCache();

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('PUT /api/permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
