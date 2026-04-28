import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await requireAction('/expenses:create');
  if (!auth.ok) return auth.response;

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
  const auth = await requireAction('/expenses:create');
  if (!auth.ok) return auth.response;
  const { session } = auth;

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

  await writeAuditLog({
    userId: session.user.id,
    action: 'CREATE',
    module: 'expenses',
    details: {
      scope: 'general',
      expenseId: expense.id,
      category: expense.category,
      amount: Number(expense.amount),
      roomId: expense.roomId,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
