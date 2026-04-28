import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string; expenseId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, expenseId } = await params;
  const auth = await requireAction('/expenses:delete');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const existing = await prisma.roomExpense.findFirst({ where: { id: expenseId, roomId: id } });
    if (!existing) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

    await prisma.roomExpense.delete({ where: { id: expenseId } });

    await writeAuditLog({
      userId: session.user.id,
      action: 'DELETE',
      module: 'expenses',
      details: {
        scope: 'room',
        roomId: id,
        expenseId,
        type: existing.type,
        amount: Number(existing.amount),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
