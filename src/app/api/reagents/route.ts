import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(_req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const reagents = await prisma.reagent.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reagents);
  } catch (error) {
    console.error('GET /api/reagents error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/lab:edit_test');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { name, unit, quantity, minQuantity, expiryDate, pricePerUnit } = body;

    if (!name || !unit) {
      return NextResponse.json({ error: 'name va unit majburiy' }, { status: 400 });
    }

    const reagent = await prisma.reagent.create({
      data: {
        name: String(name),
        unit: String(unit),
        quantity: Number(quantity ?? 0),
        minQuantity: Number(minQuantity ?? 10),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        pricePerUnit: Number(pricePerUnit ?? 0),
      },
    });

    return NextResponse.json(reagent, { status: 201 });
  } catch (error) {
    console.error('POST /api/reagents error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
