import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/rooms/[roomId]/qr-scan
// Body: { patientId: string }
// Patient QR kodini doktor xonasiga kirish uchun skanerlash
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: roomId } = await params;
  const body = await req.json() as { patientId?: string };

  if (!body.patientId?.trim()) {
    return NextResponse.json({ error: 'patientId majburiy' }, { status: 400 });
  }

  const patientId = body.patientId.trim();

  try {
    // Xonani tekshirish
    const room = await prisma.room.findFirst({ where: { id: roomId, deletedAt: null } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    // Bugun shu bemor uchun CALLED holатidagi queue topamiz
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const apptInclude = {
      patient: { select: { id: true, firstName: true, lastName: true, fatherName: true } },
      queue: true,
    } as const;

    // Variant 1: patientId + roomId + queue CALLED
    const appt1 = await prisma.appointment.findFirst({
      where: {
        patientId,
        roomId,
        dateTime: { gte: today, lt: tomorrow },
        queue: { status: 'CALLED' },
      },
      include: apptInclude,
    });

    // Variant 2: patientId + doctor's room (RoomResponsible → doktor)
    const appt2 = appt1 ? null : await prisma.appointment.findFirst({
      where: {
        patientId,
        dateTime: { gte: today, lt: tomorrow },
        queue: { status: 'CALLED' },
        doctor: {
          roomResponsible: { some: { roomId } },
        },
      },
      include: apptInclude,
    });

    // Variant 3: faqat patientId + queue CALLED
    const appt3 = (appt1 || appt2) ? null : await prisma.appointment.findFirst({
      where: {
        patientId,
        dateTime: { gte: today, lt: tomorrow },
        queue: { status: 'CALLED' },
      },
      include: apptInclude,
    });

    const appointment = appt1 ?? appt2 ?? appt3;

    if (!appointment) {
      return NextResponse.json(
        { error: 'Bemorning aktiv chaqirilgan navbati topilmadi' },
        { status: 404 }
      );
    }

    // Appointment → IN_PROGRESS
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'IN_PROGRESS' },
    });

    return NextResponse.json({
      success: true,
      patient: {
        name: `${appointment.patient.lastName} ${appointment.patient.firstName} ${appointment.patient.fatherName}`,
        queueNumber: appointment.queue?.queueNumber ?? null,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
