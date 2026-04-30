/**
 * Telegram inline keyboard quruvchi pure funksiyalar.
 *
 * Har bir funksiya Telegram Bot API'dagi `InlineKeyboardMarkup` formatini
 * qaytaradi. Callback data formati: `task:<action>:<taskId>`.
 *
 * Bot tomonida `bot.on('callback_query')` handler shu prefix bo'yicha parsing qiladi.
 */

export type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

/**
 * Yangi yaratilgan vazifa (PENDING holat) uchun keyboard.
 * Faqat "Boshlash" tugmasi.
 */
export function taskAssigneeKeyboard(taskId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '▶ Boshlash', callback_data: `task:start:${taskId}` },
    ]],
  };
}

/**
 * IN_PROGRESS holatdagi vazifa uchun keyboard.
 * "Tugatdim" va "Izoh bilan" tugmalari.
 */
export function taskInProgressKeyboard(taskId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '✅ Tugatdim', callback_data: `task:complete:${taskId}` },
      { text: '📝 Izoh bilan', callback_data: `task:complete_note:${taskId}` },
    ]],
  };
}

/**
 * COMPLETED holatdagi vazifa uchun bo'sh keyboard (tugmalar olib tashlanadi).
 */
export function taskCompletedKeyboard(): InlineKeyboardMarkup {
  return { inline_keyboard: [] };
}

/**
 * Yangi yaratilgan uchrashuv uchun doktorga yuboriladigan keyboard.
 * Doktor "Tasdiqlash" yoki "Bekor qilish" tugmalarini bosishi mumkin.
 *
 * Callback data formati: `appt:<action>:<appointmentId>`.
 */
export function appointmentDoctorKeyboard(appointmentId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '✅ Tasdiqlash', callback_data: `appt:accept:${appointmentId}` },
      { text: '❌ Bekor qilish', callback_data: `appt:reject:${appointmentId}` },
    ]],
  };
}

/**
 * Doktor o'z navbat yozuvi uchun keyboard.
 * "Chaqirish" — bemorni chaqirish, "Bajarildi" — qabul tugadi.
 *
 * Callback data formati: `queue:<action>:<queueId>`.
 */
export function queueDoctorKeyboard(queueId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '📞 Chaqirish', callback_data: `queue:call:${queueId}` },
      { text: '✅ Bajarildi', callback_data: `queue:done:${queueId}` },
    ]],
  };
}
