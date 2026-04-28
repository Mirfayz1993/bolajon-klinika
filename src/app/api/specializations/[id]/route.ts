import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/settings:manage_specs');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json() as { name?: string };
    const { name } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'name majburiy' }, { status: 400 });
    }

    const existing = await prisma.specialization.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Mutaxassislik topilmadi' }, { status: 404 });
    }

    const duplicate = await prisma.specialization.findFirst({
      where: { name: name.trim(), id: { not: id } },
    });

    if (duplicate) {
      return NextResponse.json({ error: 'Bu nomli mutaxassislik allaqachon mavjud' }, { status: 400 });
    }

    const updated = await prisma.specialization.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/settings:manage_specs');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const existing = await prisma.specialization.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mutaxassislik topilmadi' }, { status: 404 });
    }

    if (existing._count.users > 0) {
      return NextResponse.json(
        { error: 'Bu mutaxassislikka biriktirilgan xodimlar mavjud, o\'chirib bo\'lmaydi' },
        { status: 400 }
      );
    }

    await prisma.specialization.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
