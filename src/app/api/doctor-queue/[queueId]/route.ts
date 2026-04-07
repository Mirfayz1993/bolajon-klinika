import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/doctor-queue/[queueId]  { action: 'call' | 'done' | 'urgent' }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ queueId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { queueId } = await params;
  const body = await req.json() as { action: 'call' | 'done' | 'urgent' };

  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
    include: { appointment: true },
  });
  if (!queue) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

  if (body.action === 'call') {
    // Avvalgi CALLED ni WAITING ga qaytarish (faqat bitta CALLED bo'lishi kerak)
    await prisma.queue.updateMany({
      where: {
        status: 'CALLED',
        appointment: { doctorId: queue.appointment.doctorId },
      },
      data: { status: 'WAITING' },
    });

    const updated = await prisma.queue.update({
      where: { id: queueId },
      data: { status: 'CALLED', calledAt: new Date() },
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, fatherName: true } },
          },
        },
      },
    });

    // Appointment holatini IN_PROGRESS ga o'tkazish
    await prisma.appointment.update({
      where: { id: queue.appointmentId },
      data: { status: 'IN_PROGRESS' },
    });

    return NextResponse.json(updated);
  }

  if (body.action === 'done') {
    const updated = await prisma.queue.update({
      where: { id: queueId },
      data: { status: 'DONE', doneAt: new Date() },
    });
    await prisma.appointment.update({
      where: { id: queue.appointmentId },
      data: { status: 'COMPLETED' },
    });
    return NextResponse.json(updated);
  }

  if (body.action === 'urgent') {
    // Shoshilinch belgisi toggle
    const updated = await prisma.queue.update({
      where: { id: queueId },
      data: { isUrgent: !queue.isUrgent },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Noto\'g\'ri action' }, { status: 400 });
}
