import TelegramBot from 'node-telegram-bot-api';
import { handleQueue } from './handlers/queue';
import { handleResults } from './handlers/results';
import { handleDoctors } from './handlers/doctors';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

// Har bir chatId uchun telefon raqam saqlash
const userPhones = new Map<number, string>();

// /start — greeting
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Bolajon Klinika botiga xush kelibsiz!\nTelefon raqamingizni yuboring (+998XXXXXXXXX):');
});

// Telefon raqam — bemorni tekshirish
bot.on('message', async (msg) => {
  const text = msg.text?.trim();
  if (!text) return;

  // /start dan keyin telefon raqam kutiladi
  if (/^\+998\d{9}$/.test(text)) {
    // CMS API ga so'rov
    const res = await fetch(`${process.env.CMS_API_URL}/api/patients?phone=${text}`);
    const data = await res.json();
    if (data.data?.length > 0) {
      userPhones.set(msg.chat.id, text); // telefon raqamni saqlash
      // Bemor topildi — asosiy menyu
      bot.sendMessage(msg.chat.id, `Salom, ${data.data[0].firstName}!\nNima qilmoqchisiz?`, {
        reply_markup: {
          keyboard: [
            [{ text: '📋 Navbat olish' }],
            [{ text: '🔬 Tahlil natijalarim' }],
            [{ text: '👨‍⚕️ Shifokorlar ro\'yxati' }],
          ],
          resize_keyboard: true,
        }
      });
    } else {
      bot.sendMessage(msg.chat.id, 'Kechirasiz, telefon raqamingiz tizimda topilmadi.');
    }
  }

  if (text === '📋 Navbat olish') await handleQueue(bot, msg);
  if (text === '🔬 Tahlil natijalarim') {
    const chatId = msg.chat.id;
    const phone = userPhones.get(chatId);
    if (!phone) {
      return bot.sendMessage(chatId, 'Avval telefon raqamingizni yuboring.');
    }
    await handleResults(bot, msg, phone);
  }
  if (text === '👨‍⚕️ Shifokorlar ro\'yxati') await handleDoctors(bot, msg);
});

console.log('Telegram bot ishga tushdi...');
