/**
 * Vazifa inline keyboard tugmalari uchun callback handler.
 *
 * Callback data formati: `task:<action>:<taskId>`
 *   - task:start:<id>          → vazifani boshlash
 *   - task:complete:<id>       → izohsiz tugatish
 *   - task:complete_note:<id>  → izoh so'raladi (force_reply), keyin tugatiladi
 *
 * Izoh oqimi:
 *   - "📝 Izoh bilan" bosilsa → `pendingCompletionNote.set(chatId, taskId)`
 *   - Bot force_reply bilan izoh so'raydi
 *   - Foydalanuvchi javob yozsa — `pendingCompletionNote`dan taskId olinib
 *     `complete` endpoint chaqiriladi va Map'dan o'chiriladi
 *
 * MUHIM: Bemor flow (`index.ts`'dagi `bot.on('message')`)
 * `pendingCompletionNote.has(chatId)`'ni tekshirib erta return qilishi kerak.
 */

import TelegramBot from 'node-telegram-bot-api';
import { cmsRequest } from '../lib/cms-client';

/**
 * chatId → taskId xaritasi: foydalanuvchi "Izoh bilan" bosgan, lekin
 * hali izohni yozmagan vazifalar.
 *
 * `index.ts`'dagi bemor `bot.on('message')` handler shu Map'ni tekshirib,
 * agar entry bor bo'lsa o'z ishini bajarishni to'xtatishi kerak.
 */
export const pendingCompletionNote = new Map<number, string>();

type BotApiResponse = { ok: boolean; error?: string };

/** `cmsRequest` data union'idan xabarni xavfsiz olib chiqish */
function asBotResponse(d: BotApiResponse | { error?: string }): BotApiResponse {
  if ('ok' in d) return d;
  return { ok: false, error: d.error };
}

export function registerTaskCallbacks(bot: TelegramBot) {
  // -- Inline keyboard tugmalari -----------------------------------------
  bot.on('callback_query', async (cq) => {
    if (!cq.data || !cq.message) return;
    const parts = cq.data.split(':');
    if (parts[0] !== 'task') return;

    const action = parts[1];
    const taskId = parts[2];
    if (!action || !taskId) {
      await bot.answerCallbackQuery(cq.id, { text: "Noto'g'ri callback", show_alert: true });
      return;
    }

    const chatId = cq.message.chat.id;
    const messageId = cq.message.message_id;

    try {
      if (action === 'start') {
        const res = await cmsRequest<BotApiResponse>(
          'POST',
          `/api/bot/tasks/${taskId}/start`,
          { chatId },
        );
        const data = asBotResponse(res.data);
        if (!res.ok || !data.ok) {
          await bot.answerCallbackQuery(cq.id, {
            text: data.error || 'Xato',
            show_alert: true,
          });
          return;
        }
        // Tugmalarni IN_PROGRESS holatiga yangilash
        await bot.editMessageReplyMarkup(
          {
            inline_keyboard: [[
              { text: '✅ Tugatdim', callback_data: `task:complete:${taskId}` },
              { text: '📝 Izoh bilan', callback_data: `task:complete_note:${taskId}` },
            ]],
          },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.answerCallbackQuery(cq.id, { text: '▶ Boshlandi' });
        return;
      }

      if (action === 'complete') {
        const res = await cmsRequest<BotApiResponse>(
          'POST',
          `/api/bot/tasks/${taskId}/complete`,
          { chatId },
        );
        const data = asBotResponse(res.data);
        if (!res.ok || !data.ok) {
          await bot.answerCallbackQuery(cq.id, {
            text: data.error || 'Xato',
            show_alert: true,
          });
          return;
        }
        // Tugmalarni olib tashlash
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.sendMessage(chatId, '✅ Vazifa bajarildi deb belgilandi.');
        await bot.answerCallbackQuery(cq.id);
        return;
      }

      if (action === 'complete_note') {
        pendingCompletionNote.set(chatId, taskId);
        await bot.sendMessage(chatId, "📝 Bajarilish bo'yicha izohingizni yozing:", {
          reply_markup: { force_reply: true, selective: true },
        });
        await bot.answerCallbackQuery(cq.id);
        return;
      }

      await bot.answerCallbackQuery(cq.id, {
        text: "Noma'lum amal",
        show_alert: true,
      });
    } catch (e) {
      console.error('[bot] callback error:', e);
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

  // -- Force-reply javoblarini ushlash (izoh bilan tugatish) -----------------
  bot.on('message', async (msg) => {
    const taskId = pendingCompletionNote.get(msg.chat.id);
    if (!taskId) return;
    if (!msg.text || msg.text.startsWith('/')) return;

    pendingCompletionNote.delete(msg.chat.id);

    try {
      const res = await cmsRequest<BotApiResponse>(
        'POST',
        `/api/bot/tasks/${taskId}/complete`,
        { chatId: msg.chat.id, progressNote: msg.text },
      );
      const data = asBotResponse(res.data);
      if (res.ok && data.ok) {
        await bot.sendMessage(msg.chat.id, '✅ Vazifa izoh bilan yopildi.');
      } else {
        await bot.sendMessage(
          msg.chat.id,
          `Xato: ${data.error || "noma'lum"}`,
        );
      }
    } catch (e) {
      console.error('[bot] complete with note error:', e);
      await bot.sendMessage(msg.chat.id, 'Server xatosi yuz berdi.');
    }
  });
}
