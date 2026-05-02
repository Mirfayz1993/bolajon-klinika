import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireBotKey } from '@/lib/bot-auth';
import { writeAuditLog } from '@/lib/audit';
import { validateBody } from '@/lib/validate';
import { botTaskCompleteSchema } from '@/lib/schemas';
import { notifyTaskCompleted } from '@/lib/telegram/notify';

/**
 * POST /api/bot/tasks/[id]/complete
 *
 * Bot tomonidan chaqiriladi: xodim "✅ Tugatdim" yoki "📝 Izoh bilan"
 * tugmasini bosganda vazifani yopadi.
 *
 * Body: { chatId, progressNote? }
 *
 * - status IN_PROGRESS → COMPLETED
 * - completedAt = now()
 * - progressNote saqlanadi (bo'lsa)
 * - seenByAssigner = false (assigner yangi bildirishnomani ko'radi)
 *
 * Yopilgach assigner Telegram'ga ulangan bo'lsa unga xabar boradi.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireBotKey(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const parsed = await validateBody(req, botTaskCompleteSchema);
  if (!parsed.ok) return parsed.response;

  const chatId = String(parsed.data.chatId);
  const progressNote = parsed.data.progressNote;

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

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json(
      { ok: false, error: 'Vazifa topilmadi' },
      { status: 404 },
    );
  }
  if (task.assigneeId !== user.id) {
    return NextResponse.json(
      { ok: false, error: 'Bu vazifa sizga emas' },
      { status: 403 },
    );
  }
  if (task.status !== 'IN_PROGRESS') {
    return NextResponse.json(
      { ok: false, error: 'Avval vazifani boshlang' },
      { status: 400 },
    );
  }

  await prisma.task.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      progressNote: progressNote ?? undefined,
      seenByAssigner: false,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'TASK_COMPLETE_VIA_TELEGRAM',
    module: 'tasks',
    details: { taskId: id, chatId, hasNote: Boolean(progressNote) },
  });

  // Fire-and-forget: assigner'ga "Bajarildi!" xabari
  notifyTaskCompleted(id).catch((err) =>
    console.error('[telegram] notify complete failed:', err),
  );

  return NextResponse.json({ ok: true });
}
