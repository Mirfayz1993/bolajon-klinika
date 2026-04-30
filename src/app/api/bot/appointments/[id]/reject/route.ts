import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireBotKey } from '@/lib/bot-auth';
import { writeAuditLog } from '@/lib/audit';
import { validateBody } from '@/lib/validate';
import { botAppointmentRejectSchema } from '@/lib/schemas';

/**
 * POST /api/bot/appointments/[id]/reject
 *
 * Bot tomonidan chaqiriladi: doktor "❌ Bekor qilish" tugmasini bosganda
 * uchrashuvni CANCELLED holatga o'tkazadi.
 *
 * Tekshiruv:
 * - x-bot-api-key shared secret
 * - chatId orqali User topilishi va shu user appointment.doctorId bilan mosligi
 *
 * Body: { chatId, reason? }
 *
 * Eslatma: bu yerda Queue yozuvi alohida qoldiriladi — status o'zgarishi
 * bemorni navbatdan olib tashlamaydi (qabulxona qo'lda hal qiladi).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireBotKey(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const parsed = await validateBody(req, botAppointmentRejectSchema);
  if (!parsed.ok) return parsed.response;

  const chatId = String(parsed.data.chatId);
  const reason = parsed.data.reason;

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
      { ok: false, error: 'Uchrashuv allaqachon bekor qilingan' },
      { status: 400 },
    );
  }
  if (appointment.status === 'COMPLETED') {
    return NextResponse.json(
      { ok: false, error: 'Uchrashuv tugagan, bekor qilib bo\'lmaydi' },
      { status: 400 },
    );
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      notes: reason
        ? `${appointment.notes ? `${appointment.notes}\n` : ''}[Bekor qilindi: ${reason}]`
        : appointment.notes,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'APPOINTMENT_REJECT_VIA_TELEGRAM',
    module: 'appointments',
    details: { appointmentId: id, chatId, reason: reason ?? null },
  });

  return NextResponse.json({ ok: true, message: 'Uchrashuv bekor qilindi' });
}
