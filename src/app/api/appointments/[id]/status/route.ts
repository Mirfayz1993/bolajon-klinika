import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppointmentStatus, QueueStatus } from '@prisma/client';

// Map appointment status → queue status
function resolveQueueStatus(appointmentStatus: AppointmentStatus): QueueStatus {
  switch (appointmentStatus) {
    case 'IN_QUEUE':
      return 'WAITING';
    case 'IN_PROGRESS':
      return 'CALLED';
    case 'COMPLETED':
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'DONE';
    default:
      return 'WAITING';
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const existing = await prisma.appointment.findUnique({
      where: { id },
      include: { queue: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Uchrashuv topilmadi' }, { status: 404 });
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Bekor qilingan uchrashuvning statusini o\'zgartirib bo\'lmaydi' },
        { status: 400 }
      );
    }

    const body = await req.json() as { status?: string };
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'status majburiy' }, { status: 400 });
    }

    if (!Object.values(AppointmentStatus).includes(status as AppointmentStatus)) {
      return NextResponse.json({ error: 'status noto\'g\'ri qiymat' }, { status: 400 });
    }

    const newStatus = status as AppointmentStatus;
    const newQueueStatus = resolveQueueStatus(newStatus);

    // Update appointment status and queue status in transaction
    const [appointment] = await prisma.$transaction([
      prisma.appointment.update({
        where: { id },
        data: { status: newStatus },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
          doctor: {
            select: { id: true, name: true, role: true },
          },
          queue: {
            select: { queueNumber: true, status: true },
          },
        },
      }),
      // Update queue status based on appointment status
      ...(existing.queue
        ? [
            prisma.queue.update({
              where: { appointmentId: id },
              data: {
                status: newQueueStatus,
                // Set calledAt when doctor calls patient (IN_PROGRESS)
                ...(newStatus === 'IN_PROGRESS' && { calledAt: new Date() }),
              },
            }),
          ]
        : []),
    ]);

    return NextResponse.json(appointment);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
