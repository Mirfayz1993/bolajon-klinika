import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppointmentType } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        doctor: {
          select: { id: true, name: true, role: true },
        },
        room: {
          select: { id: true, floor: true, roomNumber: true, type: true },
        },
        queue: {
          select: { queueNumber: true, status: true, calledAt: true },
        },
        payments: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Uchrashuv topilmadi' }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Uchrashuv topilmadi' }, { status: 404 });
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Bekor qilingan uchrashuvni tahrirlash mumkin emas' },
        { status: 400 }
      );
    }

    const body = await req.json() as {
      patientId?: string;
      doctorId?: string;
      type?: string;
      dateTime?: string;
      roomId?: string | null;
      notes?: string | null;
    };

    const { patientId, doctorId, type, dateTime, roomId, notes } = body;

    // Validate type if provided
    if (type && !Object.values(AppointmentType).includes(type as AppointmentType)) {
      return NextResponse.json({ error: 'type noto\'g\'ri qiymat' }, { status: 400 });
    }

    // Validate dateTime if provided
    let parsedDateTime: Date | undefined;
    if (dateTime) {
      parsedDateTime = new Date(dateTime);
      if (isNaN(parsedDateTime.getTime())) {
        return NextResponse.json({ error: 'dateTime noto\'g\'ri format' }, { status: 400 });
      }
    }

    // Validate patient if provided
    if (patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) {
        return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
      }
    }

    // Validate doctor if provided
    if (doctorId) {
      const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
      if (!doctor) {
        return NextResponse.json({ error: 'Shifokor topilmadi' }, { status: 404 });
      }
    }

    // Validate room if provided
    if (roomId) {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(patientId && { patientId }),
        ...(doctorId && { doctorId }),
        ...(type && { type: type as AppointmentType }),
        ...(parsedDateTime && { dateTime: parsedDateTime }),
        ...(roomId !== undefined && { roomId: roomId ?? null }),
        ...(notes !== undefined && { notes: notes ?? null }),
      },
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Uchrashuv topilmadi' }, { status: 404 });
    }

    if (existing.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Uchrashuv allaqachon bekor qilingan' },
        { status: 400 }
      );
    }

    // Soft delete: status → CANCELLED, queue → DONE
    const [appointment] = await prisma.$transaction([
      prisma.appointment.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      prisma.queue.updateMany({
        where: { appointmentId: id },
        data: { status: 'DONE' },
      }),
    ]);

    return NextResponse.json(appointment);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
