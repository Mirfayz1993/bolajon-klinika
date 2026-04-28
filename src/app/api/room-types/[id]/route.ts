import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json() as { name?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: 'name majburiy' }, { status: 400 });

    const existing = await prisma.roomType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

    const duplicate = await prisma.roomType.findFirst({ where: { name, id: { not: id } } });
    if (duplicate) return NextResponse.json({ error: 'Bu nomli xona turi allaqachon mavjud' }, { status: 400 });

    const updated = await prisma.roomType.update({ where: { id }, data: { name } });
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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await params;
    const existing = await prisma.roomType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

    // Check if any active (non-deleted) room uses this type
    const roomCount = await prisma.room.count({ where: { type: existing.name, deletedAt: null } });
    if (roomCount > 0) {
      return NextResponse.json(
        { error: `Bu turda ${roomCount} ta xona mavjud, o'chirib bo'lmaydi` },
        { status: 400 }
      );
    }

    await prisma.roomType.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
