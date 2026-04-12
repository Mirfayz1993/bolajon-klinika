import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Noto'g'ri action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
