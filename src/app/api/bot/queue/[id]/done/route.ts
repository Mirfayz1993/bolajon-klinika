import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireBotKey } from '@/lib/bot-auth';
import { writeAuditLog } from '@/lib/audit';
import { validateBody } from '@/lib/validate';
import { botQueueActionSchema } from '@/lib/schemas';

/**
 * POST /api/bot/queue/[id]/done
 *
 * Bot tomonidan chaqiriladi: doktor "✅ Bajarildi" tugmasini bosganda
 * navbat yozuvini CALLED → DONE holatga o'tkazadi.
 * Bog'liq Appointment ham COMPLETED holatga o'tadi.
 *
 * SSE TV ekrani `/api/queue/display` har 3 soniyada DB'dan o'qiydi —
 * status o'zgarishi avtomatik tarqaladi.
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

  const parsed = await validateBody(req, botQueueActionSchema);
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

  const queue = await prisma.queue.findUnique({
    where: { id },
    include: { appointment: { select: { doctorId: true } } },
  });
  if (!queue) {
    return NextResponse.json(
      { ok: false, error: 'Navbat yozuvi topilmadi' },
      { status: 404 },
    );
  }
  if (queue.appointment.doctorId !== user.id) {
    return NextResponse.json(
      { ok: false, error: 'Bu navbat sizga emas' },
      { status: 403 },
    );
  }
  if (queue.status !== 'CALLED') {
    return NextResponse.json(
      { ok: false, error: "Avval bemorni chaqiring" },
      { status: 400 },
    );
  }

  await prisma.queue.update({
    where: { id },
    data: {
      status: 'DONE',
      doneAt: new Date(),
      appointment: {
        update: { status: 'COMPLETED' },
      },
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'QUEUE_DONE_VIA_TELEGRAM',
    module: 'queue',
    details: { queueId: id, chatId },
  });

  return NextResponse.json({ ok: true, message: 'Qabul tugadi' });
}
