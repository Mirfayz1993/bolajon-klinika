import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

/**
 * Xodim Telegram ulanishini uzish.
 *
 * Faqat o'zi (sessiya egasi shu id) yoki ADMIN ruxsat oladi.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await params;

    const isSelf = session.user.id === id;
    const isAdmin = session.user.role === 'ADMIN';
    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, telegramChatId: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Xodim topilmadi' }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: {
        telegramChatId: null,
        telegramVerificationCode: null,
        telegramVerificationExpiresAt: null,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: 'TELEGRAM_UNLINK',
      module: 'users',
      details: {
        targetUserId: id,
        previousChatId: existing.telegramChatId ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[staff/telegram/disconnect] error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
