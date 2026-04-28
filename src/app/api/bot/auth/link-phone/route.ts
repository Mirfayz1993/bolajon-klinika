import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireBotKey } from '@/lib/bot-auth';
import { validateBody } from '@/lib/validate';
import { writeAuditLog } from '@/lib/audit';

// chatId Telegram tomonidan number sifatida kelishi mumkin — string'ga aylantiramiz.
const linkPhoneSchema = z.object({
  chatId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  phone: z.string().min(4),
});

/**
 * Telefon raqamini normallashtirish:
 *  - probel/chiziq/qavslarni olib tashlash
 *  - boshida + bo'lsa saqlash, bo'lmasa qo'shish (faqat raqamlar bo'lsa)
 */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  if (!digitsOnly) return trimmed;
  return hasPlus ? `+${digitsOnly}` : `+${digitsOnly}`;
}

export async function POST(req: NextRequest) {
  const auth = requireBotKey(req);
  if (!auth.ok) return auth.response;

  const parsed = await validateBody(req, linkPhoneSchema);
  if (!parsed.ok) return parsed.response;

  const { chatId, phone } = parsed.data;
  const normalized = normalizePhone(phone);

  try {
    // Telefon bo'yicha xodimni topish
    const user = await prisma.user.findFirst({
      where: { phone: normalized, deletedAt: null },
      select: { id: true, name: true, role: true, telegramChatId: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Bu telefon raqami tizimda topilmadi' },
        { status: 404 },
      );
    }

    // Edge: shu chatId boshqa user'ga ulangan bo'lsa — eski ulanishni uzamiz
    const existingByChat = await prisma.user.findFirst({
      where: { telegramChatId: chatId, NOT: { id: user.id } },
      select: { id: true },
    });

    if (existingByChat) {
      await prisma.user.update({
        where: { id: existingByChat.id },
        data: { telegramChatId: null },
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: chatId,
        telegramVerificationCode: null,
        telegramVerificationExpiresAt: null,
      },
      select: { id: true, name: true, role: true },
    });

    await writeAuditLog({
      userId: updated.id,
      action: 'TELEGRAM_LINK',
      module: 'users',
      details: { userId: updated.id, chatId, phone: normalized },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error('[bot/link-phone] error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
