import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: patientId } = await params;

  try {
    const services = await db.assignedService.findMany({
      where: { patientId },
      include: {
        assignedBy: { select: { name: true, role: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    return NextResponse.json(services);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ALLOWED = ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'];
  if (!ALLOWED.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: patientId } = await params;
  const body = await req.json() as {
    categoryName: string;
    itemName: string;
    price: number;
    itemId?: string;
    doctorId?: string;
    isUrgent?: boolean;
  };

  if (!body.categoryName?.trim() || !body.itemName?.trim() || body.price === undefined) {
    return NextResponse.json({ error: 'Maydonlar to\'ldirilmagan' }, { status: 400 });
  }

  try {
    // Doktor tayinlangan bo'lsa — Appointment + Queue yaratamiz
    if (body.doctorId) {
      const result = await db.$transaction(async (tx: typeof db) => {
        // Bugun shu doktor uchun navbat raqami
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const lastQueue = await tx.queue.findFirst({
          where: {
            appointment: {
              doctorId: body.doctorId,
              dateTime: { gte: today, lt: tomorrow },
            },
          },
          orderBy: { queueNumber: 'desc' },
        });
        const queueNumber = (lastQueue?.queueNumber ?? 0) + 1;

        // Appointment yaratish
        const appt = await tx.appointment.create({
          data: {
            patientId,
            doctorId: body.doctorId,
            type: 'CHECKUP',
            dateTime: new Date(),
            status: 'IN_QUEUE',
          },
        });

        // Queue yaratish
        const queue = await tx.queue.create({
          data: {
            appointmentId: appt.id,
            queueNumber,
            status: 'WAITING',
            isUrgent: body.isUrgent ?? false,
          },
        });

        // AssignedService yaratish
        const service = await tx.assignedService.create({
          data: {
            patientId,
            categoryName: body.categoryName.trim(),
            itemName: body.itemName.trim(),
            price: body.price,
            itemId: body.itemId ?? null,
            assignedById: session.user.id,
            doctorId: body.doctorId,
            appointmentId: appt.id,
            isUrgent: body.isUrgent ?? false,
          },
          include: {
            assignedBy: { select: { name: true, role: true } },
          },
        });

        return { service, appointment: appt, queue };
      });

      return NextResponse.json(result.service, { status: 201 });
    }

    // Oddiy xizmat (doctorId yo'q)
    const service = await db.assignedService.create({
      data: {
        patientId,
        categoryName: body.categoryName.trim(),
        itemName: body.itemName.trim(),
        price: body.price,
        itemId: body.itemId ?? null,
        assignedById: session.user.id,
      },
      include: {
        assignedBy: { select: { name: true, role: true } },
      },
    });
    return NextResponse.json(service, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: patientId } = await params;
  const { serviceId } = await req.json() as { serviceId: string };

  try {
    const svc = await db.assignedService.findFirst({ where: { id: serviceId, patientId } });
    if (!svc) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
    if (svc.isPaid) return NextResponse.json({ error: 'To\'langan xizmatni o\'chirib bo\'lmaydi' }, { status: 400 });

    // Agar appointment va queue bo'lsa — ularni ham o'chirish
    if (svc.appointmentId) {
      await db.queue.deleteMany({ where: { appointmentId: svc.appointmentId } });
      await db.appointment.delete({ where: { id: svc.appointmentId } }).catch(() => null);
    }

    await db.assignedService.delete({ where: { id: serviceId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
