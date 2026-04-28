import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';
import { notifyTaskCreated } from '@/lib/telegram/notify';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { searchParams } = new URL(req.url);
  const unread = searchParams.get('unread') === 'true';
  const userId = session.user.id;
  const isAdmin = session.user.role === 'ADMIN';

  try {
    const where = isAdmin ? {} : {
      OR: [
        { assigneeId: userId },
        { assignerId: userId },
      ],
    };

    if (unread) {
      const count = await prisma.task.count({
        where: { assigneeId: userId, seenByAssignee: false },
      });
      return NextResponse.json({ count });
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assigner: { select: { id: true, name: true, role: true } },
        assignee: {
          select: {
            id: true,
            name: true,
            role: true,
            telegramChatId: true,
          },
        },
      },
    });

    // assignee.telegramChatId privacy uchun raw qaytarmaymiz — faqat boolean
    const sanitized = tasks.map((t) => ({
      ...t,
      assignee: {
        id: t.assignee.id,
        name: t.assignee.name,
        role: t.assignee.role,
        hasTelegram: Boolean(t.assignee.telegramChatId),
      },
    }));

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/tasks:create');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const isAdmin = session.user.role === 'ADMIN';

  try {
    const body = await req.json() as {
      title: string;
      description?: string;
      deadline: string;
      assigneeId: string;
    };

    const { title, description, deadline, assigneeId } = body;
    if (!title || !deadline || !assigneeId) {
      return NextResponse.json({ error: 'title, deadline, assigneeId majburiy' }, { status: 400 });
    }

    // Check task assign permission (kim kimga task bera oladi)
    if (!isAdmin) {
      const perm = await prisma.taskAssignPermission.findFirst({
        where: { assignerId: session.user.id, targetUserId: assigneeId },
      });
      if (!perm) {
        return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? undefined,
        deadline: new Date(deadline),
        assignerId: session.user.id,
        assigneeId,
        seenByAssignee: false,
        seenByAssigner: true,
      },
      include: {
        assigner: { select: { id: true, name: true, role: true } },
        assignee: { select: { id: true, name: true, role: true } },
      },
    });

    // Fire-and-forget: Telegram bildirishnomasini kutmaymiz
    notifyTaskCreated(task.id).catch((err) =>
      console.error('[telegram] notify create failed:', err),
    );

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
