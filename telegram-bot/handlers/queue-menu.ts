/**
 * Doktor uchun navbat menyusi.
 *
 * Komandalar:
 *   - /navbat — bugungi navbatni ko'rsatadi (bemor ismi, queue number, status,
 *     har biri uchun inline keyboard: "Chaqirish" yoki "Bajarildi").
 */

import TelegramBot from 'node-telegram-bot-api';
import { cmsRequest } from '../lib/cms-client';

type QueueItem = {
  id: string;
  queueNumber: number;
  status: 'WAITING' | 'CALLED' | 'DONE' | string;
  patient: {
    firstName: string;
    lastName: string;
  };
};

type QueueResponse = {
  ok: boolean;
  data?: QueueItem[];
  error?: string;
};

function asQueueResponse(d: QueueResponse | { error?: string }): QueueResponse {
  if ('ok' in d) return d;
  return { ok: false, error: d.error };
}

function statusLabel(status: string): string {
  switch (status) {
    case 'WAITING':
      return 'KUTYAPTI';
    case 'CALLED':
      return 'CHAQIRILGAN';
    case 'DONE':
      return 'BAJARILGAN';
    default:
      return status;
  }
}

/**
 * Bemor familiyasini qisqartiradi: "Karimov Anvar" → "Karimov A."
 */
function formatPatient(item: QueueItem): string {
  const last = item.patient.lastName || '';
  const firstInitial = item.patient.firstName
    ? item.patient.firstName.charAt(0).toUpperCase() + '.'
    : '';
  return `${last} ${firstInitial}`.trim();
}

export function registerQueueMenu(bot: TelegramBot) {
  bot.onText(/^\/navbat$/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const res = await cmsRequest<QueueResponse>(
        'GET',
        `/api/bot/queue?chatId=${chatId}`,
      );
      const data = asQueueResponse(res.data);

      if (!res.ok || !data.ok) {
        await bot.sendMessage(
          chatId,
          `Xato yuz berdi: ${data.error || "navbatni olib bo'lmadi"}`,
        );
        return;
      }

      const items = data.data || [];
      if (items.length === 0) {
        await bot.sendMessage(chatId, '📋 Bugun navbatda bemor yo\'q.');
        return;
      }

      // Header
      await bot.sendMessage(
        chatId,
        `📋 Bugungi navbat (${items.length} ta):`,
      );

      // Har bir bemor uchun alohida xabar — chunki har birida o'z inline keyboard'i
      for (const item of items) {
        const text = `#${item.queueNumber} ${formatPatient(item)} — ${statusLabel(item.status)}`;

        let keyboard: TelegramBot.InlineKeyboardButton[][] | null = null;
        if (item.status === 'WAITING') {
          keyboard = [[
            { text: '📞 Chaqirish', callback_data: `queue:call:${item.id}` },
          ]];
        } else if (item.status === 'CALLED') {
          keyboard = [[
            { text: '✅ Bajarildi', callback_data: `queue:done:${item.id}` },
          ]];
        }

        await bot.sendMessage(chatId, text, {
          reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
        });
      }
    } catch (e) {
      console.error('[bot] /navbat error:', e);
      await bot.sendMessage(chatId, 'Xato yuz berdi: server xatosi.');
    }
  });
}
