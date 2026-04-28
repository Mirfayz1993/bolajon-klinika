import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireBotKey } from '@/lib/bot-auth';
import { writeAuditLog } from '@/lib/audit';
import { validateBody } from '@/lib/validate';
import { botTaskStartSchema } from '@/lib/schemas';

/**
 * POST /api/bot/tasks/[id]/start
 *
 * Bot tomonidan chaqiriladi: xodim "▶ Boshlash" tugmasini bosganda
 * vazifa statusini PENDING → IN_PROGRESS'ga o'tkazadi.
 *
 * Auth: `x-bot-api-key` shared secret + chatId orqali assignee tekshiruvi.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireBotKey(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const parsed = await validateBody(req, botTaskStartSchema);
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
  if (task.status !== 'PENDING') {
    return NextResponse.json(
      { ok: false, error: 'Vazifa allaqachon boshlangan' },
      { status: 400 },
    );
  }

  await prisma.task.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      seenByAssignee: true,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'TASK_START_VIA_TELEGRAM',
    module: 'tasks',
    details: { taskId: id, chatId },
  });

  return NextResponse.json({ ok: true });
}
