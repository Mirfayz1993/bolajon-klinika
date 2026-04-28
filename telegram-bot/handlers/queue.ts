import TelegramBot from 'node-telegram-bot-api';

export async function handleQueue(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  try {
    const res = await fetch(`${process.env.CMS_API_URL}/api/queue`);
    const data = (await res.json()) as { data?: Array<{ queueNumber: number; appointment: { patient: { firstName: string; lastName: string }; doctor: { name: string } } }> };

    if (!data.data || data.data.length === 0) {
      return bot.sendMessage(chatId, 'Hozir navbatda hech kim yo\'q.');
    }

    const text = data.data
      .map((q) =>
        `#${q.queueNumber} — ${q.appointment.patient.firstName} → Dr. ${q.appointment.doctor.name}`)
      .join('\n');

    bot.sendMessage(chatId, `Bugungi navbat:\n${text}`);
  } catch {
    bot.sendMessage(chatId, 'Xatolik yuz berdi. Keyinroq urinib ko\'ring.');
  }
}
