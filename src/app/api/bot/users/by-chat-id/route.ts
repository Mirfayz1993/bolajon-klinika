import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireBotKey } from '@/lib/bot-auth';

/**
 * Bot tomonidan: berilgan chatId qaysi xodimga ulangan?
 *
 * Topilsa: { ok: true, user: {...} }
 * Topilmasa: { ok: false } (404 emas — bot uchun bu normal, patient bo'lishi mumkin)
 */
export async function GET(req: NextRequest) {
  const auth = requireBotKey(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return NextResponse.json(
      { ok: false, error: 'chatId parameter required' },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findFirst({
      where: { telegramChatId: chatId, deletedAt: null },
      select: { id: true, name: true, role: true, phone: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error('[bot/by-chat-id] error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
