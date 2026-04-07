import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as {
      name?: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
      status?: 'ACTIVE' | 'WRITTEN_OFF';
    };

    const existing = await prisma.roomInventoryItem.findFirst({ where: { id: itemId, roomId: id } });
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

    const updated = await prisma.roomInventoryItem.update({
      where: { id: itemId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description.trim() || null }),
        ...(body.quantity !== undefined && { quantity: Number(body.quantity) }),
        ...(body.unitPrice !== undefined && { unitPrice: body.unitPrice }),
        ...(body.status !== undefined && { status: body.status }),
      },
      include: { addedBy: { select: { name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const existing = await prisma.roomInventoryItem.findFirst({ where: { id: itemId, roomId: id } });
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

    await prisma.roomInventoryItem.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
