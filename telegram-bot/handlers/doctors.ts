import TelegramBot from 'node-telegram-bot-api';

export async function handleDoctors(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  try {
    const res = await fetch(`${process.env.CMS_API_URL}/api/staff?role=DOCTOR`);
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      return bot.sendMessage(chatId, 'Shifokorlar ro\'yxati topilmadi.');
    }

    const text = data.data
      .map((d: { name: string; specializations?: { name: string }[] }) =>
        `👨‍⚕️ ${d.name}${d.specializations?.[0] ? ` — ${d.specializations[0].name}` : ''}`)
      .join('\n');

    bot.sendMessage(chatId, `Shifokorlar:\n${text}`);
  } catch {
    bot.sendMessage(chatId, 'Xatolik yuz berdi. Keyinroq urinib ko\'ring.');
  }
}
