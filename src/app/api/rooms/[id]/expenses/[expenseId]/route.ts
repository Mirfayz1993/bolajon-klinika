import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string; expenseId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, expenseId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const existing = await prisma.roomExpense.findFirst({ where: { id: expenseId, roomId: id } });
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

    await prisma.roomExpense.delete({ where: { id: expenseId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
