/**
 * Navbat (queue) inline keyboard tugmalari uchun callback handler.
 *
 * Callback data formati: `queue:<action>:<queueId>`
 *   - queue:call:<id>  → bemorni chaqirish (status WAITING → CALLED)
 *   - queue:done:<id>  → bajarildi (status CALLED → DONE)
 */

import TelegramBot from 'node-telegram-bot-api';
import { cmsRequest } from '../lib/cms-client';

type BotApiResponse = { ok: boolean; error?: string };

/** `cmsRequest` data union'idan xabarni xavfsiz olib chiqish */
function asBotResponse(d: BotApiResponse | { error?: string }): BotApiResponse {
  if ('ok' in d) return d;
  return { ok: false, error: d.error };
}

export function registerQueueCallbacks(bot: TelegramBot) {
  bot.on('callback_query', async (cq) => {
    if (!cq.data || !cq.message) return;
    const parts = cq.data.split(':');
    if (parts[0] !== 'queue') return;

    const action = parts[1];
    const queueId = parts[2];
    if (!action || !queueId) {
      await bot.answerCallbackQuery(cq.id, { text: "Noto'g'ri callback", show_alert: true });
      return;
    }

    const chatId = cq.message.chat.id;
    const messageId = cq.message.message_id;

    try {
      if (action === 'call') {
        const res = await cmsRequest<BotApiResponse>(
          'POST',
          `/api/bot/queue/${queueId}/call`,
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
        // CALLED holatiga o'tdi — endi faqat "Bajarildi" tugmasi qoladi
        await bot.editMessageReplyMarkup(
          {
            inline_keyboard: [[
              { text: '✅ Bajarildi', callback_data: `queue:done:${queueId}` },
            ]],
          },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.answerCallbackQuery(cq.id, { text: '📞 Chaqirildi' });
        return;
      }

      if (action === 'done') {
        const res = await cmsRequest<BotApiResponse>(
          'POST',
          `/api/bot/queue/${queueId}/done`,
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
        await bot.sendMessage(chatId, '✅ Bemor qabul qilindi (bajarildi).');
        await bot.answerCallbackQuery(cq.id, { text: '✅ Bajarildi' });
        return;
      }

      await bot.answerCallbackQuery(cq.id, {
        text: "Noma'lum amal",
        show_alert: true,
      });
    } catch (e) {
      console.error('[bot] queue callback error:', e);
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
}
