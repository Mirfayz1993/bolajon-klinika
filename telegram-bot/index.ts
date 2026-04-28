import { config } from 'dotenv';
import { resolve } from 'path';
// CMS root .env'ni o'qish (telegram-bot papkasidan bir pog'ona yuqori)
config({ path: resolve(__dirname, '../.env') });

import TelegramBot from 'node-telegram-bot-api';
import { handleQueue } from './handlers/queue';
import { handleResults } from './handlers/results';
import { handleDoctors } from './handlers/doctors';
import { cmsRequest } from './lib/cms-client';
import {
  registerTaskCallbacks,
  pendingCompletionNote,
} from './handlers/task-callbacks';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

// Eski bemor flow uchun chatId ↔ telefon mapping
const userPhones = new Map<number, string>();

type StaffUser = { id: string; name: string; role: string; phone?: string };

// /start — avval xodim ulanganmi tekshiramiz, bo'lmasa contact so'raymiz
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // 1) Bu chatId ulangan xodim?
  const userRes = await cmsRequest<{ ok: boolean; user?: StaffUser }>(
    'GET',
    `/api/bot/users/by-chat-id?chatId=${chatId}`,
  );

  if (
    userRes.ok &&
    userRes.data &&
    'ok' in userRes.data &&
    userRes.data.ok &&
    'user' in userRes.data &&
    userRes.data.user
  ) {
    const u = userRes.data.user;
    return bot.sendMessage(
      chatId,
      `Salom, ${u.name}!\nSiz xodim sifatida ulangansiz. Yangi vazifalar kelganida bu yerga xabar boradi.`,
    );
  }

  // 2) Aks holda — contact so'rash (xodim YOKI bemor uchun)
  bot.sendMessage(
    chatId,
    'Bolajon Klinika botiga xush kelibsiz!\nTelegram hisobingizni klinika tizimiga ulash uchun telefon raqamingizni yuboring:',
    {
      reply_markup: {
        keyboard: [[{ text: '📱 Telefon raqamimni yuborish', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    },
  );
});

// Contact handler — Telegram contact orqali telefon
bot.on('contact', async (msg) => {
  if (!msg.contact?.phone_number) return;
  const chatId = msg.chat.id;
  let phone = msg.contact.phone_number;
  if (!phone.startsWith('+')) phone = '+' + phone;

  // 1) Avval xodim sifatida ulashga harakat
  const linkRes = await cmsRequest<{
    ok: boolean;
    user?: { id: string; name: string; role: string };
    error?: string;
  }>('POST', '/api/bot/auth/link-phone', { chatId: String(chatId), phone });

  if (
    linkRes.ok &&
    linkRes.data &&
    'ok' in linkRes.data &&
    linkRes.data.ok &&
    'user' in linkRes.data &&
    linkRes.data.user
  ) {
    return bot.sendMessage(
      chatId,
      `✅ Salom, ${linkRes.data.user.name}! Siz klinika tizimiga ulandingiz.\nEndi sizga vazifalar kelganida shu yerga xabar boradi.`,
      { reply_markup: { remove_keyboard: true } },
    );
  }

  // 2) Xodim emas — bemor flow (mavjud bemor topilsa menyu ko'rsat)
  try {
    const res = await fetch(`${process.env.CMS_API_URL}/api/patients?phone=${encodeURIComponent(phone)}`);
    const data = (await res.json()) as { data?: Array<{ firstName: string }> };
    if (data.data && data.data.length > 0) {
      userPhones.set(chatId, phone);
      return bot.sendMessage(chatId, `Salom, ${data.data[0].firstName}!\nNima qilmoqchisiz?`, {
        reply_markup: {
          keyboard: [
            [{ text: '📋 Navbat olish' }],
            [{ text: '🔬 Tahlil natijalarim' }],
            [{ text: "👨‍⚕️ Shifokorlar ro'yxati" }],
          ],
          resize_keyboard: true,
        },
      });
    }
  } catch {
    /* fall through */
  }

  bot.sendMessage(chatId, 'Kechirasiz, telefon raqamingiz tizimda topilmadi.', {
    reply_markup: { remove_keyboard: true },
  });
});

// Eski bemor flow — text orqali +998... yuborish (foydalanuvchilar odatlanganligi uchun saqlanadi)
bot.on('message', async (msg) => {
  // Contact xabarlari yuqorida hal qilingan
  if (msg.contact) return;
  // Vazifa "Izoh bilan tugatish" oqimida bo'lsa — task-callbacks handleridan o'tkazib yuboramiz
  if (pendingCompletionNote.has(msg.chat.id)) return;
  const text = msg.text?.trim();
  if (!text) return;

  // /start dan keyin telefon raqam (eski usul) — faqat bemor uchun
  if (/^\+998\d{9}$/.test(text)) {
    const chatId = msg.chat.id;

    // Avval xodim sifatida ulashga harakat (telefon raqam orqali)
    const linkRes = await cmsRequest<{
      ok: boolean;
      user?: { id: string; name: string; role: string };
    }>('POST', '/api/bot/auth/link-phone', { chatId: String(chatId), phone: text });

    if (
      linkRes.ok &&
      linkRes.data &&
      'ok' in linkRes.data &&
      linkRes.data.ok &&
      'user' in linkRes.data &&
      linkRes.data.user
    ) {
      return bot.sendMessage(
        chatId,
        `✅ Salom, ${linkRes.data.user.name}! Siz klinika tizimiga ulandingiz.\nEndi sizga vazifalar kelganida shu yerga xabar boradi.`,
      );
    }

    // Xodim topilmadi — bemor flow
    try {
      const res = await fetch(`${process.env.CMS_API_URL}/api/patients?phone=${encodeURIComponent(text)}`);
      const data = (await res.json()) as { data?: Array<{ firstName: string }> };
      if (data.data && data.data.length > 0) {
        userPhones.set(chatId, text);
        return bot.sendMessage(chatId, `Salom, ${data.data[0].firstName}!\nNima qilmoqchisiz?`, {
          reply_markup: {
            keyboard: [
              [{ text: '📋 Navbat olish' }],
              [{ text: '🔬 Tahlil natijalarim' }],
              [{ text: "👨‍⚕️ Shifokorlar ro'yxati" }],
            ],
            resize_keyboard: true,
          },
        });
      }
      return bot.sendMessage(chatId, 'Kechirasiz, telefon raqamingiz tizimda topilmadi.');
    } catch {
      return bot.sendMessage(chatId, "Xatolik yuz berdi. Keyinroq urinib ko'ring.");
    }
  }

  // Bemor menyu tugmalari
  if (text === '📋 Navbat olish') await handleQueue(bot, msg);
  if (text === '🔬 Tahlil natijalarim') {
    const chatId = msg.chat.id;
    const phone = userPhones.get(chatId);
    if (!phone) {
      return bot.sendMessage(chatId, 'Avval telefon raqamingizni yuboring.');
    }
    await handleResults(bot, msg, phone);
  }
  if (text === "👨‍⚕️ Shifokorlar ro'yxati") await handleDoctors(bot, msg);
});

// Vazifa callback'lari (▶ Boshlash, ✅ Tugatdim, 📝 Izoh bilan)
registerTaskCallbacks(bot);

console.log('Telegram bot ishga tushdi...');
