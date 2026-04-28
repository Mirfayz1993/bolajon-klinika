import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const reagent = await prisma.reagent.findUnique({ where: { id } });
    if (!reagent) {
      return NextResponse.json({ error: 'Reagent topilmadi' }, { status: 404 });
    }
    return NextResponse.json(reagent);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireAction('/lab:edit_test');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();
  const { name, unit, quantity, minQuantity, expiryDate, pricePerUnit } = body;
  try {
    const updated = await prisma.reagent.update({
      where: { id },
      data: {
        name: String(name),
        unit: String(unit),
        quantity: Number(quantity ?? 0),
        minQuantity: Number(minQuantity ?? 10),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        pricePerUnit: Number(pricePerUnit ?? 0),
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAction('/lab:delete');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await prisma.reagent.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
