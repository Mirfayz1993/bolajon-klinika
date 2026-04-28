import { NextRequest, NextResponse } from 'next/server';

export type BotAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * Telegram bot ↔ CMS o'rtasidagi shared secret tekshiruvi.
 *
 * Bot har so'rovda `x-bot-api-key` header yuborishi kerak.
 * `BOT_API_KEY` env'ga teng bo'lsa — ruxsat, aks holda 401.
 *
 * Foydalanish:
 *   const auth = requireBotKey(req);
 *   if (!auth.ok) return auth.response;
 */
export function requireBotKey(req: NextRequest): BotAuthResult {
  const provided = req.headers.get('x-bot-api-key');
  const expected = process.env.BOT_API_KEY;
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'BOT_API_KEY env not configured' },
        { status: 500 },
      ),
    };
  }
  if (provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true };
}
