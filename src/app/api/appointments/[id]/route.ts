import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AppointmentType } from '@prisma/client';
import { requireSession, requireAction } from '@/lib/api-auth';
import {
  notifyAppointmentCreated,
  notifyAppointmentUpdated,
  notifyAppointmentCancelled,
  editTelegramMessage,
} from '@/lib/telegram/notify';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
  const auth = await requireAction('/appointments:edit');
  if (!auth.ok) return auth.response;

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
      const room = await prisma.room.findFirst({ where: { id: roomId, deletedAt: null } });
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

    // Telegram xabarni sinxronlash
    try {
      // Doktor o'zgartirilgan bo'lsa: eski xabarni "boshqa shifokorga o'tkazildi"
      // qilib edit qilamiz, yangi doktorga yangi xabar yuboramiz.
      if (doctorId && doctorId !== existing.doctorId) {
        if (existing.telegramMessageId) {
          const oldDoctor = await prisma.user.findUnique({
            where: { id: existing.doctorId },
            select: { telegramChatId: true },
          });
          if (oldDoctor?.telegramChatId) {
            await editTelegramMessage(
              oldDoctor.telegramChatId,
              existing.telegramMessageId,
              '❌ Uchrashuv boshqa shifokorga o\'tkazildi.',
              { reply_markup: { inline_keyboard: [] }, parse_mode: 'HTML' },
            );
          }
        }
        await notifyAppointmentCreated(id);
      } else {
        // Bir xil doktor — xabarni yangilash
        await notifyAppointmentUpdated(id);
      }
    } catch (err) {
      console.error('[telegram] sync after update failed:', err);
    }

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
  const auth = await requireAction('/appointments:delete');
  if (!auth.ok) return auth.response;

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

    // Telegram xabarni sinxronlash
    try {
      await notifyAppointmentCancelled(id);
    } catch (err) {
      console.error('[telegram] cancel notify failed:', err);
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
