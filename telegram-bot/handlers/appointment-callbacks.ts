/**
 * Uchrashuv (appointment) inline keyboard tugmalari uchun callback handler.
 *
 * Callback data formati: `appt:<action>:<appointmentId>`
 *   - appt:accept:<id>  → uchrashuvni qabul qilish
 *   - appt:reject:<id>  → uchrashuvni rad qilish (sabab so'raladi, ixtiyoriy)
 *
 * Rad etish oqimi:
 *   - "❌ Rad etish" bosilsa → `pendingRejectReason.set(chatId, appointmentId)`
 *   - Bot force_reply bilan sabab so'raydi
 *   - Foydalanuvchi javob yozsa — `pendingRejectReason`dan id olinib
 *     `reject` endpoint chaqiriladi va Map'dan o'chiriladi.
 *   - Foydalanuvchi `/skip` yoki `-` yozsa, sababsiz reject qilinadi.
 */

import TelegramBot from 'node-telegram-bot-api';
import { cmsRequest } from '../lib/cms-client';

/**
 * chatId → appointmentId xaritasi: foydalanuvchi "Rad etish" bosgan, lekin
 * hali sababini yozmagan uchrashuvlar.
 */
export const pendingRejectReason = new Map<number, string>();

type BotApiResponse = { ok: boolean; error?: string };

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
        // Sabab so'rash — force_reply
        pendingRejectReason.set(chatId, appointmentId);
        await bot.sendMessage(
          chatId,
          "📝 Rad etish sababini yozing (yoki '-' yuboring sababsiz rad etish uchun):",
          {
            reply_markup: { force_reply: true, selective: true },
          },
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
    const appointmentId = pendingRejectReason.get(msg.chat.id);
    if (!appointmentId) return;
    if (!msg.text || msg.text.startsWith('/')) return;

    pendingRejectReason.delete(msg.chat.id);

    const reasonRaw = msg.text.trim();
    const reason = reasonRaw === '-' ? undefined : reasonRaw;

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
