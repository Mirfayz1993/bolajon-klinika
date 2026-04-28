import { NextRequest, NextResponse } from 'next/server';
import { requireAction } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/doctor-queue/[queueId]  { action: 'call' | 'done' | 'urgent' }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ queueId: string }> }
) {
  const auth = await requireAction('/doctor-queue:manage');
  if (!auth.ok) return auth.response;

  const { queueId } = await params;
  const body = await req.json() as { action: 'call' | 'done' | 'urgent' | 'accept' };

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

    // Appointment holatini IN_QUEUE da qoldirish — QR scan kelganda IN_PROGRESS bo'ladi
    await prisma.appointment.update({
      where: { id: queue.appointmentId },
      data: { status: 'IN_QUEUE' },
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

  // Qabul qilish: QR siz ham qabul — appointment IN_PROGRESS, xona BAND
  if (body.action === 'accept') {
    await prisma.appointment.update({
      where: { id: queue.appointmentId },
      data: { status: 'IN_PROGRESS' },
    });

    // Doktorning xonasini topib OCCUPIED qilish
    const responsible = await prisma.roomResponsible.findFirst({
      where: { userId: queue.appointment.doctorId },
    });
    if (responsible) {
      // Xona IN_PROGRESS appointmentga bog'lanishi uchun appointment.roomId yangilash
      await prisma.appointment.update({
        where: { id: queue.appointmentId },
        data: { roomId: responsible.roomId },
      });
    }

    const updated = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      ...updated,
      patientId: queue.appointment.patientId,
    });
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
