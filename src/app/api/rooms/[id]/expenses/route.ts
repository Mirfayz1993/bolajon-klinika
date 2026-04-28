import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const room = await prisma.room.findFirst({ where: { id, deletedAt: null } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type') as 'INVENTORY' | 'MEDICINE' | 'UTILITY' | null;

    const where = typeFilter ? { roomId: id, type: typeFilter } : { roomId: id };

    const expenses = await prisma.roomExpense.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    // Jami summalar (har tur bo'yicha)
    const allExpenses = await prisma.roomExpense.findMany({ where: { roomId: id } });
    const totals = {
      INVENTORY: allExpenses.filter(e => e.type === 'INVENTORY').reduce((s, e) => s + Number(e.amount), 0),
      MEDICINE: allExpenses.filter(e => e.type === 'MEDICINE').reduce((s, e) => s + Number(e.amount), 0),
      UTILITY: allExpenses.filter(e => e.type === 'UTILITY').reduce((s, e) => s + Number(e.amount), 0),
      all: allExpenses.reduce((s, e) => s + Number(e.amount), 0),
    };

    return NextResponse.json({ expenses, totals });
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
      type?: string;
      amount?: number;
      description?: string;
      date?: string;
    };

    if (!body.type || !['INVENTORY', 'MEDICINE', 'UTILITY'].includes(body.type)) {
      return NextResponse.json({ error: 'type majburiy (INVENTORY | MEDICINE | UTILITY)' }, { status: 400 });
    }
    if (!body.amount || Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'amount musbat son bo\'lishi kerak' }, { status: 400 });
    }

    const room = await prisma.room.findFirst({ where: { id, deletedAt: null } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const expense = await prisma.roomExpense.create({
      data: {
        roomId: id,
        type: body.type as 'INVENTORY' | 'MEDICINE' | 'UTILITY',
        amount: body.amount,
        description: body.description?.trim() || null,
        date: body.date ? new Date(body.date) : new Date(),
        createdById: session.user.id,
      },
      include: { createdBy: { select: { name: true } } },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
