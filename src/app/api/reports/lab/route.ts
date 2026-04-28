import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LabTestStatus } from '@prisma/client';
import { requireAction } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAction('/reports:see_financial');
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

    const labTests = await prisma.labTest.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: {
        status: true,
        testType: {
          select: {
            name: true,
            price: true,
          },
        },
      },
    });

    const totalTests = labTests.length;

    const byStatus: Record<LabTestStatus, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    // testType bo'yicha agregatsiya
    const byTypeMap: Record<string, { count: number; revenue: number }> = {};

    for (const t of labTests) {
      byStatus[t.status] += 1;

      const typeName = t.testType.name;
      if (!byTypeMap[typeName]) {
        byTypeMap[typeName] = { count: 0, revenue: 0 };
      }
      byTypeMap[typeName].count += 1;
      // Faqat COMPLETED testlar daromadga kiritilsin
      if (t.status === 'COMPLETED') {
        byTypeMap[typeName].revenue += Number(t.testType.price);
      }
    }

    const byType = Object.entries(byTypeMap).map(([name, data]) => ({
      name,
      count: data.count,
      revenue: data.revenue,
    }));

    const completionRate =
      totalTests > 0
        ? Math.round((byStatus.COMPLETED / totalTests) * 100 * 100) / 100
        : 0;

    return NextResponse.json({
      totalTests,
      byStatus,
      byType,
      completionRate,
    });
  } catch (error) {
    console.error('[reports/lab]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
