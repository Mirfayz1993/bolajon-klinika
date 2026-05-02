/**
 * Uchrashuv (appointment) inline keyboard tugmalari uchun callback handler.
 *
 * Callback data formati: `appt:<action>:<appointmentId>`
 *   - appt:accept:<id>  → uchrashuvni qabul qilish
 *   - appt:reject:<id>  → uchrashuvni rad qilish (sabab so'raladi, ixtiyoriy)
 *
 * Rad etish oqimi (marker pattern — Map'siz, bot restart'ga chidamli):
 *   - "❌ Rad etish" bosilsa → bot `force_reply` xabar yuboradi va xabar matn
 *     oxiriga `[id:<appointmentId>]` markerini yashiradi.
 *   - Foydalanuvchi javob bersa, Telegram `reply_to_message.text`'ni qaytaradi.
 *     Marker'dan appointmentId ajratib olib `reject` endpoint chaqiriladi.
 *   - Foydalanuvchi `-` yoki `/skip` yozsa, sababsiz reject qilinadi.
 *   - Boshqa `/buyruq`lar (masalan `/start`, `/menu`) reply'da kelsa — e'tiborsiz qoldiriladi.
 *
 * Map ishlatilmaydi:
 *   - bot restart bo'lsa ham doktor reply qila oladi (state Telegram serverida)
 *   - bir doktor ketma-ket bir nechta reject qilsa kollizya bo'lmaydi
 *     (har xabarda o'z markeri bor)
 */

import TelegramBot from 'node-telegram-bot-api';
import { cmsRequest } from '../lib/cms-client';

type BotApiResponse = { ok: boolean; error?: string };

/** Force-reply xabarni boshqa reply'lardan ajratish uchun marker matn. */
const REJECT_PROMPT_MARKER = 'Rad etish sababini';

/** `cmsRequest` data union'idan xabarni xavfsiz olib chiqish */
function asBotResponse(d: BotApiResponse | { error?: string }): BotApiResponse {
  if ('ok' in d) return d;
  return { ok: false, error: d.error };
}

export function registerAppointmentCallbacks(bot: TelegramBot) {
  // -- Inline keyboard tugmalari -----------------------------------------
  bot.on('callback_query', async (cq) => {
    if (!cq.data || !cq.message) return;
    const parts = cq.data.split(':');
    if (parts[0] !== 'appt') return;

    const action = parts[1];
    const appointmentId = parts[2];
    if (!action || !appointmentId) {
      await bot.answerCallbackQuery(cq.id, { text: "Noto'g'ri callback", show_alert: true });
      return;
    }

    const chatId = cq.message.chat.id;
    const messageId = cq.message.message_id;

    try {
      if (action === 'accept') {
        const res = await cmsRequest<BotApiResponse>(
          'POST',
          `/api/bot/appointments/${appointmentId}/accept`,
          { chatId },
        );
        const data = asBotResponse(res.data);
        if (!res.ok || !data.ok) {
          await bot.answerCallbackQuery(cq.id, {
            text: data.error || 'Xato yuz berdi',
            show_alert: true,
          });
          return;
        }
        // Tugmalarni olib tashlash
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.sendMessage(chatId, '✅ Uchrashuv qabul qilindi.');
        await bot.answerCallbackQuery(cq.id, { text: '✅ Qabul qilindi' });
        return;
      }

      if (action === 'reject') {
        // Sabab so'rash — force_reply.
        // appointmentId xabar matnida marker sifatida yashiriladi:
        // foydalanuvchi javob bersa Telegram reply_to_message.text'ni qaytaradi
        // va biz undan id'ni regex bilan ajratamiz. Map shart emas.
        await bot.sendMessage(
          chatId,
          `📝 ${REJECT_PROMPT_MARKER} yozing (yoki '-' yuboring sababsiz rad etish uchun):\n\n[id:${appointmentId}]`,
          { reply_markup: { force_reply: true, selective: true } },
        );
        await bot.answerCallbackQuery(cq.id);
        return;
      }

      await bot.answerCallbackQuery(cq.id, {
        text: "Noma'lum amal",
        show_alert: true,
      });
    } catch (e) {
      console.error('[bot] appointment callback error:', e);
      try {
        await bot.answerCallbackQuery(cq.id, {
          text: 'Server xatosi',
          show_alert: true,
        });
      } catch {
        /* ignore */
      }
    }
  });

  // -- Force-reply javoblarini ushlash (rad etish sababi) -----------------
  bot.on('message', async (msg) => {
    // Faqat reply'lar bizga qiziq
    const replyText = msg.reply_to_message?.text;
    if (!replyText) return;

    // Bot o'zining "Rad etish sababini..." force-reply xabariga reply ekanligini
    // tekshirish (boshqa reply'larni ushlamaymiz)
    if (!replyText.includes(REJECT_PROMPT_MARKER)) return;

    // Marker'dan appointmentId chiqarish
    const match = replyText.match(/\[id:([^\]]+)\]/);
    if (!match) return;
    const appointmentId = match[1];

    if (!msg.text) return;

    const trimmed = msg.text.trim();

    // /skip yoki '-' = sababsiz reject
    const isSkip = trimmed === '/skip' || trimmed === '-';

    // Boshqa /buyruq'lar (masalan /start, /menu) — bu reject sababi emas
    if (!isSkip && trimmed.startsWith('/')) return;

    const reason = isSkip ? undefined : trimmed;

    try {
      const res = await cmsRequest<BotApiResponse>(
        'POST',
        `/api/bot/appointments/${appointmentId}/reject`,
        reason ? { chatId: msg.chat.id, reason } : { chatId: msg.chat.id },
      );
      const data = asBotResponse(res.data);
      if (res.ok && data.ok) {
        await bot.sendMessage(msg.chat.id, '❌ Uchrashuv rad etildi.');
      } else {
        await bot.sendMessage(
          msg.chat.id,
          `Xato yuz berdi: ${data.error || "noma'lum"}`,
        );
      }
    } catch (e) {
      console.error('[bot] appointment reject with reason error:', e);
      await bot.sendMessage(msg.chat.id, 'Xato yuz berdi: server xatosi.');
    }
  });
}
