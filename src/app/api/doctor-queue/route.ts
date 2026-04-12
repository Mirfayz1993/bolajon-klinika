import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/doctor-queue?doctorId=xxx
// Bugungi navbat ro'yxati, tartib: isUrgent → isPriority → queueNumber
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doctorId = new URL(req.url).searchParams.get('doctorId') ?? session.user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const queues = await prisma.queue.findMany({
    where: {
      status: { in: ['WAITING', 'CALLED'] },
      appointment: {
        doctorId,
        dateTime: { gte: today, lt: tomorrow },
      },
    },
    include: {
      appointment: {
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true, fatherName: true, phone: true, birthDate: true },
          },
          doctor: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { isUrgent: 'desc' },
      { isPriority: 'desc' },
      { queueNumber: 'asc' },
    ],
  });

  // Done list (bugun)
  const done = await prisma.queue.findMany({
    where: {
      status: 'DONE',
      appointment: { doctorId, dateTime: { gte: today, lt: tomorrow } },
    },
    include: {
      appointment: {
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { doneAt: 'desc' },
  });

  // Mutaxassislar ro'yxati (admin/receptionist uchun)
  const doctors = await prisma.user.findMany({
    where: { role: { in: ['DOCTOR', 'HEAD_DOCTOR', 'SPEECH_THERAPIST', 'MASSAGE_THERAPIST'] }, isActive: true, deletedAt: null },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });

  // Doktorning xonasi (RoomResponsible orqali)
  const roomResponsible = await prisma.roomResponsible.findFirst({
    where: { userId: doctorId },
    select: { roomId: true, room: { select: { id: true, roomNumber: true, floor: true } } },
  });

  return NextResponse.json({ queues, done, doctors, roomId: roomResponsible?.roomId ?? null, room: roomResponsible?.room ?? null });
}
