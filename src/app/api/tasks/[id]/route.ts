import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyAction, requireSession } from '@/lib/api-auth';
import { notifyTaskCompleted } from '@/lib/telegram/notify';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assigner: { select: { id: true, name: true, role: true } },
        assignee: { select: { id: true, name: true, role: true } },
      },
    });
    if (!task) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
    return NextResponse.json(task);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Action-level: assignee'ning o'zi yoki manager (assign/complete_others) o'zgartira oladi.
  const auth = await requireAnyAction('/tasks:assign', '/tasks:complete_others');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

    const isAssignee = task.assigneeId === session.user.id;
    const isAssigner = task.assignerId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    const body = await req.json() as {
      action?: 'start' | 'complete' | 'seen' | 'seen_assigner';
      progressNote?: string;
    };

    const { action, progressNote } = body;

    if (action === 'seen' && (isAssignee || isAdmin)) {
      await prisma.task.update({ where: { id }, data: { seenByAssignee: true } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'seen_assigner' && (isAssigner || isAdmin)) {
      await prisma.task.update({ where: { id }, data: { seenByAssigner: true } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'start') {
      if (!isAssignee && !isAdmin) return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
      if (task.status !== 'PENDING') return NextResponse.json({ error: "Holat noto'g'ri" }, { status: 400 });
      const updated = await prisma.task.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startedAt: new Date(), seenByAssignee: true },
        include: {
          assigner: { select: { id: true, name: true, role: true } },
          assignee: { select: { id: true, name: true, role: true } },
        },
      });
      return NextResponse.json(updated);
    }

    if (action === 'complete') {
      if (!isAssignee && !isAdmin) return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
      if (task.status !== 'IN_PROGRESS') return NextResponse.json({ error: 'Avval boshlang' }, { status: 400 });
      const updated = await prisma.task.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          progressNote: progressNote ?? undefined,
          seenByAssigner: false, // notify assigner
        },
        include: {
          assigner: { select: { id: true, name: true, role: true } },
          assignee: { select: { id: true, name: true, role: true } },
        },
      });

      // Fire-and-forget: assigner Telegram'ga ulangan bo'lsa xabar boradi
      notifyTaskCompleted(id).catch((err) =>
        console.error('[telegram] notify complete failed:', err),
      );

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Noto'g'ri action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
