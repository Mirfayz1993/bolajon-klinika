import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    // Faqat aktiv (o'chirilmagan) xona uchun inventarni qaytaramiz
    const room = await prisma.room.findFirst({ where: { id, deletedAt: null } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

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
  const auth = await requireAction('/rooms:manage_inventory');
  if (!auth.ok) return auth.response;
  const { session } = auth;

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

    const room = await prisma.room.findFirst({ where: { id, deletedAt: null } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const totalAmount = body.unitPrice ? body.unitPrice * quantity : null;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.roomInventoryItem.create({
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

      // Inventar tarixi yozuvi
      await tx.roomInventoryLog.create({
        data: {
          roomId: id,
          inventoryItemId: created.id,
          action: 'ADDED',
          quantity,
          comment: body.description?.trim() || null,
          performedById: session.user.id,
        },
      });

      // Agar narx bo'lsa — xarajat yozuvi (Moliya/Xarajatlar)
      if (totalAmount && totalAmount > 0) {
        await tx.roomExpense.create({
          data: {
            roomId: id,
            type: 'INVENTORY',
            amount: totalAmount,
            description: `Inventar xarajati: ${name} (${quantity} dona)`,
            date: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
            createdById: session.user.id,
          },
        });
      }

      return created;
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
