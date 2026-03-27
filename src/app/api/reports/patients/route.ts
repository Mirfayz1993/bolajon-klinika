import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role, AppointmentStatus } from '@prisma/client';

const ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.HEAD_NURSE];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(now.getDate() - 30);
    defaultFrom.setHours(0, 0, 0, 0);

    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const dateFrom = fromParam ? new Date(fromParam) : defaultFrom;
    const dateTo = toParam ? new Date(toParam) : now;

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json({ error: 'from yoki to sanasi noto\'g\'ri format' }, { status: 400 });
    }
    if (dateFrom > dateTo) {
      return NextResponse.json({ error: 'from sanasi to dan katta bo\'lishi mumkin emas' }, { status: 400 });
    }

    dateTo.setHours(23, 59, 59, 999);

    // Jami bemorlar soni
    const totalPatients = await prisma.patient.count();

    // Yangi bemorlar — from-to oralig'ida yaratilgan
    const newPatients = await prisma.patient.count({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    });

    // from-to oralig'idagi uchrashuvlar
    const appointments = await prisma.appointment.findMany({
      where: {
        dateTime: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: {
        status: true,
      },
    });

    const totalAppointments = appointments.length;

    const byStatus: Record<AppointmentStatus, number> = {
      SCHEDULED: 0,
      IN_QUEUE: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
    };

    for (const a of appointments) {
      byStatus[a.status] += 1;
    }

    // from-to oralig'idagi statsionar yotqizishlar
    const totalAdmissions = await prisma.admission.count({
      where: {
        admissionDate: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    });

    // Hozir yotganlar — dischargeDate null
    const activeAdmissions = await prisma.admission.count({
      where: {
        dischargeDate: null,
      },
    });

    return NextResponse.json({
      totalPatients,
      newPatients,
      totalAppointments,
      byStatus,
      totalAdmissions,
      activeAdmissions,
    });
  } catch (error) {
    console.error('[reports/patients]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
