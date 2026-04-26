import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { requireRole, ROLE_GROUPS } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireRole(ROLE_GROUPS.ADMIN_ONLY);
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

    // Barcha xodimlar soni
    const totalStaff = await prisma.user.count();

    // Faol xodimlar
    const activeStaff = await prisma.user.count({
      where: { isActive: true },
    });

    // Rol bo'yicha taqsimot
    const users = await prisma.user.findMany({
      select: { role: true },
    });

    const byRole: Record<Role, number> = {
      ADMIN: 0,
      HEAD_DOCTOR: 0,
      DOCTOR: 0,
      HEAD_NURSE: 0,
      NURSE: 0,
      HEAD_LAB_TECH: 0,
      LAB_TECH: 0,
      RECEPTIONIST: 0,
      SPEECH_THERAPIST: 0,
      MASSAGE_THERAPIST: 0,
      SANITARY_WORKER: 0,
      PHARMACIST: 0,
    };

    for (const u of users) {
      byRole[u.role] += 1;
    }

    // Davr ichida to'langan maoshlar summasi
    const paidSalaries = await prisma.salary.aggregate({
      where: {
        status: 'PAID',
        paidAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      _sum: { amount: true },
    });

    const totalSalaryPaid = Number(paidSalaries._sum.amount ?? 0);

    // Jadvallar soni (Schedule model vaqt filtrisiz — umumiy jadvallar)
    const scheduleCount = await prisma.schedule.count();

    return NextResponse.json({
      totalStaff,
      activeStaff,
      byRole,
      totalSalaryPaid,
      scheduleCount,
    });
  } catch (error) {
    console.error('[reports/staff]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
