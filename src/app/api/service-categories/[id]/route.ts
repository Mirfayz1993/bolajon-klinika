import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireAction('/settings:manage_service_categories');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { name, isActive } = await req.json() as { name?: string; isActive?: boolean };

  const data: { name?: string; isActive?: boolean } = {};
  if (name !== undefined) data.name = name.trim();
  if (isActive !== undefined) data.isActive = isActive;

  try {
    const updated = await db.serviceCategory.update({
      where: { id },
      data,
      include: { items: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAction('/settings:manage_service_categories');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await db.serviceCategory.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
