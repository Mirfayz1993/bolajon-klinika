import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const category = searchParams.get('category');

  const where: Record<string, unknown> = {};
  if (roomId) where.roomId = roomId;
  if (category) where.category = category;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = new Date(from);
    if (to) (where.date as Record<string, unknown>).lte = new Date(to + 'T23:59:59');
  }

  const expenses = await prisma.generalExpense.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { room: { select: { roomNumber: true, floor: true } } },
    take: 200,
  });

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  return NextResponse.json({ expenses, total });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { category, amount, description, roomId, date } = body;

  if (!category || !amount || !description)
    return NextResponse.json({ error: "Kategoriya, miqdor va tavsif majburiy" }, { status: 400 });

  const expense = await prisma.generalExpense.create({
    data: {
      category: String(category),
      amount: Number(amount),
      description: String(description),
      roomId: roomId || null,
      date: date ? new Date(date) : new Date(),
      createdById: session.user.id,
    },
    include: { room: { select: { roomNumber: true, floor: true } } },
  });

  return NextResponse.json(expense, { status: 201 });
}
