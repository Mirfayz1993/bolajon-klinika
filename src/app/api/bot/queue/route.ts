import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireBotKey } from '@/lib/bot-auth';

/**
 * GET /api/bot/queue?chatId=...
 *
 * Bot tomonidan chaqiriladi: doktor o'z bugungi navbatini ko'rishi uchun.
 *
 * Tekshiruv:
 * - x-bot-api-key shared secret
 * - chatId orqali User topilishi (deletedAt: null)
 *
 * Response: { ok, queue: [{ id, queueNumber, patient: {...}, status, calledAt }, ...] }
 *
 * Faqat WAITING va CALLED holatdagi yozuvlar qaytariladi (DONE chiqarilmaydi).
 */
export async function GET(req: NextRequest) {
  const auth = requireBotKey(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');
  if (!chatId) {
    return NextResponse.json(
      { ok: false, error: 'chatId majburiy' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId, deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Foydalanuvchi topilmadi' },
      { status: 404 },
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const queues = await prisma.queue.findMany({
    where: {
      status: { in: ['WAITING', 'CALLED'] },
      appointment: {
        doctorId: user.id,
        dateTime: { gte: startOfDay, lt: startOfNextDay },
      },
    },
    include: {
      appointment: {
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              birthDate: true,
              gender: true,
            },
          },
        },
      },
    },
    orderBy: { queueNumber: 'asc' },
  });

  const queueList = queues.map((q) => ({
    id: q.id,
    queueNumber: q.queueNumber,
    status: q.status,
    isUrgent: q.isUrgent,
    isPriority: q.isPriority,
    calledAt: q.calledAt,
    appointmentId: q.appointmentId,
    appointmentTime: q.appointment.dateTime,
    patient: {
      firstName: q.appointment.patient.firstName,
      lastName: q.appointment.patient.lastName,
      phone: q.appointment.patient.phone,
      birthDate: q.appointment.patient.birthDate,
      gender: q.appointment.patient.gender,
    },
  }));

  return NextResponse.json({ ok: true, queue: queueList });
}
