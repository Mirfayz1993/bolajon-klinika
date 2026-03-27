import TelegramBot from 'node-telegram-bot-api';

export async function handleResults(bot: TelegramBot, msg: TelegramBot.Message, phone: string) {
  const chatId = msg.chat.id;
  try {
    // Avval bemorni telefon raqam bo'yicha topish
    const patientRes = await fetch(`${process.env.CMS_API_URL}/api/patients?phone=${encodeURIComponent(phone)}`);
    const patientData = await patientRes.json();

    if (!patientData.data || patientData.data.length === 0) {
      return bot.sendMessage(chatId, 'Bemor topilmadi.');
    }

    const patientId = patientData.data[0].id;

    // Bemorning lab testlarini olish
    const res = await fetch(`${process.env.CMS_API_URL}/api/lab-tests?patientId=${patientId}&status=COMPLETED&limit=5`);
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      return bot.sendMessage(chatId, 'Tayyor tahlil natijangiz topilmadi.');
    }

    const text = data.data
      .map((t: { testType: { name: string }; createdAt: string }) =>
        `• ${t.testType.name} — ${new Date(t.createdAt).toLocaleDateString('uz-UZ')}`)
      .join('\n');

    bot.sendMessage(chatId, `Tahlil natijalari:\n${text}`);
  } catch {
    bot.sendMessage(chatId, 'Xatolik yuz berdi. Keyinroq urinib ko\'ring.');
  }
}
