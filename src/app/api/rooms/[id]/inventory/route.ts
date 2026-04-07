import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const items = await prisma.roomInventoryItem.findMany({
      where: { roomId: id },
      include: { addedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as {
      name?: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
      purchaseDate?: string;
    };

    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: 'Jihoz nomi majburiy' }, { status: 400 });

    const quantity = body.quantity ? Number(body.quantity) : 1;
    if (quantity < 1) return NextResponse.json({ error: 'Miqdor 1 dan kam bo\'lmasin' }, { status: 400 });

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const item = await prisma.roomInventoryItem.create({
      data: {
        roomId: id,
        name,
        description: body.description?.trim() || null,
        quantity,
        unitPrice: body.unitPrice ? body.unitPrice : null,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
        addedById: session.user.id,
      },
      include: { addedBy: { select: { name: true } } },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
