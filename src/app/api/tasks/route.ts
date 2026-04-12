import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
        assignee: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    // Check permission
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

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
