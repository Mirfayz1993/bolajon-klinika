/**
 * Telegram Bot API'ga raw xabar yuborish va vazifa bildirishnomalari.
 *
 * - `sendTelegramMessage` — quyi darajadagi raw helper
 * - `notifyTaskCreated` — vazifa yaratilganda assignee'ga inline keyboard bilan xabar
 * - `notifyTaskCompleted` — vazifa bajarilganda assigner'ga xabar
 *
 * Bu funksiyalar fire-and-forget tarzda chaqiriladi (CMS API endpoint'lari
 * Telegram javobini kutmaydi). Xato bo'lsa stderr'ga structured log yoziladi.
 */

import { prisma } from '@/lib/prisma';
import { taskAssigneeKeyboard, appointmentDoctorKeyboard } from './keyboards';

type SendOpts = {
  reply_markup?: unknown;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
};

export type TelegramSendResult = {
  ok: boolean;
  result?: { message_id: number };
  error_code?: number;
  description?: string;
};

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  opts: SendOpts = {},
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN env not configured');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...opts }),
  });
  return res.json() as Promise<TelegramSendResult>;
}

/**
 * Vazifa yaratilganda assignee'ga Telegram xabar yuborish.
 *
 * - Agar assignee Telegram'ga ulanmagan (`telegramChatId == null`) → sukut, hech narsa qilinmaydi
 * - Yuborilgan bo'lsa: `Task.telegramMessageId` va `Task.notifiedAt` saqlanadi
 * - Xato bo'lsa: stderr'ga log, lekin throw qilinmaydi (fire-and-forget)
 */
export async function notifyTaskCreated(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { telegramChatId: true, name: true } },
      assigner: { select: { name: true } },
    },
  });
  if (!task) {
    console.error('[telegram] notifyTaskCreated: task not found', { taskId });
    return;
  }
  if (!task.assignee?.telegramChatId) return; // ulanmagan — sukut

  const text = formatTaskMessage({
    title: task.title,
    description: task.description,
    deadline: task.deadline,
    assigner: { name: task.assigner.name },
  });

  const result = await sendTelegramMessage(
    task.assignee.telegramChatId,
    text,
    { reply_markup: taskAssigneeKeyboard(task.id), parse_mode: 'HTML' },
  );

  if (result.ok && result.result?.message_id) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        telegramMessageId: result.result.message_id,
        notifiedAt: new Date(),
      },
    });
  } else {
    console.error('[telegram] notifyTaskCreated failed:', {
      taskId,
      error_code: result.error_code,
      description: result.description,
    });
  }
}

/**
 * Vazifa bajarilganda assigner'ga Telegram xabar yuborish.
 *
 * - Assigner Telegram'ga ulanmagan bo'lsa → sukut
 * - Inline keyboard yo'q (faqat ma'lumot xabari)
 */
export async function notifyTaskCompleted(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { name: true } },
      assigner: { select: { telegramChatId: true } },
    },
  });
  if (!task) {
    console.error('[telegram] notifyTaskCompleted: task not found', { taskId });
    return;
  }
  if (!task.assigner?.telegramChatId) return;

  const text =
    `✅ Vazifa bajarildi!\n\n` +
    `📋 <b>${escapeHtml(task.title)}</b>\n` +
    `👤 ${escapeHtml(task.assignee.name)}` +
    (task.progressNote ? `\n📝 Izoh: ${escapeHtml(task.progressNote)}` : '');

  const result = await sendTelegramMessage(
    task.assigner.telegramChatId,
    text,
    { parse_mode: 'HTML' },
  );

  if (!result.ok) {
    console.error('[telegram] notifyTaskCompleted failed:', {
      taskId,
      error_code: result.error_code,
      description: result.description,
    });
  }
}

function formatTaskMessage(task: {
  title: string;
  description: string | null;
  deadline: Date;
  assigner: { name: string };
}): string {
  const deadline = new Date(task.deadline).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    `📋 <b>Yangi vazifa!</b>\n\n` +
    `<b>${escapeHtml(task.title)}</b>\n` +
    (task.description ? `\n${escapeHtml(task.description)}\n` : '') +
    `\n⏰ Muddat: ${deadline}\n` +
    `👤 Bergan: ${escapeHtml(task.assigner.name)}`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Bemor uchrashuvga yozilganda doktorga Telegram xabar yuborish.
 *
 * - Agar doktor Telegram'ga ulanmagan (`telegramChatId == null`) → sukut
 * - Yuborilgan bo'lsa: `Appointment.telegramMessageId` va `Appointment.notifiedAt` saqlanadi
 * - Xato bo'lsa: stderr'ga log, lekin throw qilinmaydi (fire-and-forget)
 */
export async function notifyAppointmentCreated(
  appointmentId: string,
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: true,
      doctor: { select: { telegramChatId: true, name: true } },
      room: { select: { roomNumber: true, floor: true } },
    },
  });
  if (!appointment) {
    console.error('[telegram] notifyAppointmentCreated: appointment not found', {
      appointmentId,
    });
    return;
  }
  if (!appointment.doctor?.telegramChatId) return; // ulanmagan — sukut

  const text = formatAppointmentMessage({
    patient: {
      firstName: appointment.patient.firstName,
      lastName: appointment.patient.lastName,
      birthDate: appointment.patient.birthDate,
      gender: appointment.patient.gender,
      phone: appointment.patient.phone,
    },
    dateTime: appointment.dateTime,
    room: appointment.room
      ? { roomNumber: appointment.room.roomNumber, floor: appointment.room.floor }
      : null,
    notes: appointment.notes,
  });

  try {
    const result = await sendTelegramMessage(
      appointment.doctor.telegramChatId,
      text,
      {
        reply_markup: appointmentDoctorKeyboard(appointment.id),
        parse_mode: 'HTML',
      },
    );

    if (result.ok && result.result?.message_id) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          telegramMessageId: result.result.message_id,
          notifiedAt: new Date(),
        },
      });
    } else {
      console.error('[telegram] notifyAppointmentCreated failed:', {
        appointmentId,
        error_code: result.error_code,
        description: result.description,
      });
    }
  } catch (err) {
    console.error('[telegram] notifyAppointmentCreated error:', {
      appointmentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Doktor "Chaqirish" tugmasini bosganda — bemorga (telefon orqali ulangan bo'lsa) xabar.
 *
 * HOZIRDA: bot bemorlar bilan ulashmagan, shuning uchun bu funksiya no-op.
 * Kelajakda bemor `Patient.telegramChatId` orqali ulansa shu yerda xabar yuboriladi.
 */
export async function notifyQueueCalled(queueId: string): Promise<void> {
  // No-op: bemor Telegram bilan ulashish hali yo'q.
  // Funksiya signature kelajakdagi integratsiya uchun saqlangan.
  void queueId;
}

function formatAppointmentMessage(appointment: {
  patient: {
    firstName: string;
    lastName: string;
    birthDate: Date;
    gender: string | null;
    phone: string;
  };
  dateTime: Date;
  room: { roomNumber: string; floor: number } | null;
  notes: string | null;
}): string {
  const dateTimeStr = new Date(appointment.dateTime).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const age = calculateAge(appointment.patient.birthDate);
  const genderLabel =
    appointment.patient.gender === 'MALE'
      ? 'erkak'
      : appointment.patient.gender === 'FEMALE'
        ? 'ayol'
        : null;
  const ageGenderParts = [
    `${age} yosh`,
    genderLabel,
  ].filter(Boolean) as string[];
  const ageGender = ageGenderParts.length > 0 ? ` (${ageGenderParts.join(', ')})` : '';

  const fullName = escapeHtml(
    `${appointment.patient.lastName} ${appointment.patient.firstName}`,
  );

  const roomLine = appointment.room
    ? `\n🚪 Xona: ${escapeHtml(appointment.room.roomNumber)} (${appointment.room.floor}-qavat)`
    : '';

  const notesLine = appointment.notes
    ? `\n📝 Tashxis: ${escapeHtml(appointment.notes)}`
    : '';

  return (
    `🩺 <b>Yangi uchrashuv!</b>\n\n` +
    `👤 Bemor: <b>${fullName}</b>${ageGender}\n` +
    `📞 Telefon: ${escapeHtml(appointment.patient.phone)}\n` +
    `📅 Vaqt: ${dateTimeStr}` +
    roomLine +
    notesLine
  );
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age < 0 ? 0 : age;
}
