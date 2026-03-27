import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppointmentType, AppointmentStatus, Role } from '@prisma/client';

const READ_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.HEAD_NURSE, Role.RECEPTIONIST];
const WRITE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.RECEPTIONIST];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!READ_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const doctorId = searchParams.get('doctorId');
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const where: {
      dateTime?: { gte: Date; lt: Date };
      doctorId?: string;
      patientId?: string;
      status?: AppointmentStatus;
      type?: AppointmentType;
    } = {};

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      // Use next day start for strict lt comparison
      const startOfNextDay = new Date(startOfDay);
      startOfNextDay.setDate(startOfNextDay.getDate() + 1);

      where.dateTime = { gte: startOfDay, lt: startOfNextDay };
    }

    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;

    if (status && Object.values(AppointmentStatus).includes(status as AppointmentStatus)) {
      where.status = status as AppointmentStatus;
    }

    if (type && Object.values(AppointmentType).includes(type as AppointmentType)) {
      where.type = type as AppointmentType;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { dateTime: 'asc' },
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
    });

    return NextResponse.json({ data: appointments, total: appointments.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!WRITE_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      patientId?: string;
      doctorId?: string;
      type?: string;
      dateTime?: string;
      roomId?: string;
      notes?: string;
    };

    const { patientId, doctorId, type, dateTime, roomId, notes } = body;

    if (!patientId || !doctorId || !type || !dateTime) {
      return NextResponse.json(
        { error: 'patientId, doctorId, type, dateTime majburiy' },
        { status: 400 }
      );
    }

    if (!Object.values(AppointmentType).includes(type as AppointmentType)) {
      return NextResponse.json({ error: 'type noto\'g\'ri qiymat' }, { status: 400 });
    }

    const parsedDateTime = new Date(dateTime);
    if (isNaN(parsedDateTime.getTime())) {
      return NextResponse.json({ error: 'dateTime noto\'g\'ri format' }, { status: 400 });
    }

    // Validate patient exists
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
    }

    // Validate doctor exists
    const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      return NextResponse.json({ error: 'Shifokor topilmadi' }, { status: 404 });
    }

    // Validate room if provided
    if (roomId) {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
      }
    }

    // Calculate today's queue number for this doctor
    const startOfDay = new Date(parsedDateTime);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfNextDay = new Date(startOfDay);
    startOfNextDay.setDate(startOfNextDay.getDate() + 1);

    const todayQueues = await prisma.queue.count({
      where: {
        appointment: {
          doctorId,
          dateTime: { gte: startOfDay, lt: startOfNextDay },
        },
      },
    });
    const queueNumber = todayQueues + 1;

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        type: type as AppointmentType,
        dateTime: parsedDateTime,
        roomId: roomId ?? undefined,
        notes: notes ?? undefined,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        doctor: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // Create queue entry
    const queue = await prisma.queue.create({
      data: {
        appointmentId: appointment.id,
        queueNumber,
      },
    });

    return NextResponse.json({ ...appointment, queue }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
