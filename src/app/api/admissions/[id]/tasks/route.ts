import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSession } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { taskCreateSchema } from '@/lib/schemas';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id: admissionId } = await params;

  try {
    const tasks = await prisma.task.findMany({
      where: { admissionId },
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE']);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: admissionId } = await params;

  try {
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, patientId: true, status: true },
    });
    if (!admission) return NextResponse.json({ error: 'Statsionar topilmadi' }, { status: 404 });
    if (admission.status === 'DISCHARGED') {
      return NextResponse.json({ error: 'Bemor chiqarilgan' }, { status: 400 });
    }

    const parsed = await validateBody(req, taskCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Default deadline: 24 hours from now
    const deadline = body.deadline ? new Date(body.deadline) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description,
        deadline,
        assignerId: session.user.id,
        assigneeId: body.assigneeId,
        admissionId,
        patientId: admission.patientId,
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
