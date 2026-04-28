import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';

// GET /api/rooms/[roomId]/status
// Xonaning hozirgi holati: AVAILABLE yoki OCCUPIED
// Bugungi IN_PROGRESS appointment asosida aniqlanadi
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id: roomId } = await params;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Xona to'g'ridan-to'g'ri appointment.roomId orqali bog'langan bo'lsa
    const inProgressAppointment = await prisma.appointment.findFirst({
      where: {
        roomId,
        status: 'IN_PROGRESS',
        dateTime: { gte: today, lt: tomorrow },
      },
      include: {
        patient: { select: { firstName: true, lastName: true, fatherName: true } },
        queue: { select: { queueNumber: true } },
      },
    });

    if (inProgressAppointment) {
      return NextResponse.json({
        status: 'OCCUPIED',
        currentPatient: {
          name: `${inProgressAppointment.patient.lastName} ${inProgressAppointment.patient.firstName} ${inProgressAppointment.patient.fatherName}`,
          queueNumber: inProgressAppointment.queue?.queueNumber ?? null,
        },
      });
    }

    // Doctor's room orqali tekshirish (RoomResponsible → doktor → appointment)
    const roomResponsible = await prisma.roomResponsible.findUnique({
      where: { roomId },
      select: { userId: true },
    });

    if (roomResponsible) {
      const doctorInProgress = await prisma.appointment.findFirst({
        where: {
          doctorId: roomResponsible.userId,
          status: 'IN_PROGRESS',
          dateTime: { gte: today, lt: tomorrow },
        },
        include: {
          patient: { select: { firstName: true, lastName: true, fatherName: true } },
          queue: { select: { queueNumber: true } },
        },
      });

      if (doctorInProgress) {
        return NextResponse.json({
          status: 'OCCUPIED',
          currentPatient: {
            name: `${doctorInProgress.patient.lastName} ${doctorInProgress.patient.firstName} ${doctorInProgress.patient.fatherName}`,
            queueNumber: doctorInProgress.queue?.queueNumber ?? null,
          },
        });
      }
    }

    return NextResponse.json({ status: 'AVAILABLE' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
