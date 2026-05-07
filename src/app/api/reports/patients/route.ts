import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AppointmentStatus } from '@prisma/client';
import { requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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

    // Mustaqil query'larni parallel ravishda ishga tushirish
    const [
      totalPatients,
      newPatients,
      appointments,
      totalAdmissions,
      activeAdmissions,
    ] = await Promise.all([
      // Jami bemorlar soni
      prisma.patient.count(),
      // Yangi bemorlar — from-to oralig'ida yaratilgan
      prisma.patient.count({
        where: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
      // from-to oralig'idagi uchrashuvlar
      prisma.appointment.findMany({
        where: {
          dateTime: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        select: {
          status: true,
        },
      }),
      // from-to oralig'idagi statsionar yotqizishlar
      prisma.admission.count({
        where: {
          admissionDate: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
      // Hozir yotganlar — dischargeDate null
      prisma.admission.count({
        where: {
          dischargeDate: null,
        },
      }),
    ]);

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
