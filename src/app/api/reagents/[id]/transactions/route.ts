import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

// GET — reaktor tranzaksiyalari
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const txs = await prisma.reagentTransaction.findMany({
    where: { reagentId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json(txs);
}

// POST — kirim qo'shish
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const qty = Number(body.quantity ?? 0);
  if (qty <= 0) return NextResponse.json({ error: "Miqdor 0 dan katta bo'lsin" }, { status: 400 });

  try {
    await prisma.$transaction([
      prisma.reagentTransaction.create({
        data: { reagentId: id, type: 'IN', quantity: qty, note: body.note ?? null, userId: session.user.id },
      }),
      prisma.reagent.update({
        where: { id },
        data: { quantity: { increment: qty } },
      }),
    ]);
    const updated = await prisma.reagent.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
