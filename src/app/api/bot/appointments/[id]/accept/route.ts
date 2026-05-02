import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireBotKey } from '@/lib/bot-auth';
import { writeAuditLog } from '@/lib/audit';
import { validateBody } from '@/lib/validate';
import { botAppointmentAcceptSchema } from '@/lib/schemas';

/**
 * POST /api/bot/appointments/[id]/accept
 *
 * Bot tomonidan chaqiriladi: doktor "✅ Tasdiqlash" tugmasini bosganda
 * uchrashuvga tasdiqlash izi yoziladi.
 *
 * Mantiq:
 * - status o'zgartirilmaydi — SCHEDULED holatida qoladi
 * - faqat `confirmedAt` field'iga timestamp yoziladi
 * - idempotent: agar `confirmedAt` allaqachon set bo'lsa qayta yozilmaydi
 *   va audit log yozilmaydi (spam'dan himoya)
 *
 * Tekshiruv:
 * - x-bot-api-key shared secret
 * - chatId orqali User topilishi va shu user appointment.doctorId bilan mosligi
 *
 * Body: { chatId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireBotKey(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const parsed = await validateBody(req, botAppointmentAcceptSchema);
  if (!parsed.ok) return parsed.response;

  const chatId = String(parsed.data.chatId);

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

  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) {
    return NextResponse.json(
      { ok: false, error: 'Uchrashuv topilmadi' },
      { status: 404 },
    );
  }
  if (appointment.doctorId !== user.id) {
    return NextResponse.json(
      { ok: false, error: 'Bu uchrashuv sizga emas' },
      { status: 403 },
    );
  }
  if (appointment.status === 'CANCELLED') {
    return NextResponse.json(
      { ok: false, error: "Uchrashuv bekor qilingan, tasdiqlash mumkin emas" },
      { status: 400 },
    );
  }
  if (appointment.status === 'COMPLETED') {
    return NextResponse.json(
      { ok: false, error: 'Uchrashuv allaqachon tugagan' },
      { status: 400 },
    );
  }

  // Idempotensiya: agar uchrashuv allaqachon tasdiqlangan bo'lsa qayta yozmaymiz
  // va audit log yozmaymiz (Telegram retry yoki ikki marta bosilsa spam bo'lmasin)
  if (appointment.confirmedAt) {
    return NextResponse.json({
      ok: true,
      message: 'Uchrashuv allaqachon tasdiqlangan',
    });
  }

  await prisma.appointment.update({
    where: { id },
    data: { confirmedAt: new Date() },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'APPOINTMENT_ACCEPT_VIA_TELEGRAM',
    module: 'appointments',
    details: { appointmentId: id, chatId },
  });

  return NextResponse.json({ ok: true, message: 'Uchrashuv tasdiqlandi' });
}
