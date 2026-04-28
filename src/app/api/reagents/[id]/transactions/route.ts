import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

// GET — reaktor tranzaksiyalari
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
  const auth = await requireAction('/lab:edit_test');
  if (!auth.ok) return auth.response;
  const { session } = auth;

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
