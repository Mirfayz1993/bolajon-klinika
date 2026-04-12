import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user?.role as string;
    const allowed = ['ADMIN', 'HEAD_LAB_TECH', 'LAB_TECH'];
    if (!allowed.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user?.role as string;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
