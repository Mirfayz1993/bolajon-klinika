import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentCategory, PaymentMethod } from '@prisma/client';
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

    // dateTo ni kun oxiriga o'rnat
    dateTo.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: {
        amount: true,
        method: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });

    const byCategory: Record<PaymentCategory, number> = {
      CHECKUP: 0,
      LAB_TEST: 0,
      SPEECH_THERAPY: 0,
      MASSAGE: 0,
      TREATMENT: 0,
      INPATIENT: 0,
      AMBULATORY: 0,
    };

    const byMethod: Record<PaymentMethod, number> = {
      CASH: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
      CLICK: 0,
      PAYME: 0,
    };

    const byDayMap: Record<string, number> = {};

    let totalRevenue = 0;
    let totalPending = 0;
    let paymentCount = 0;

    for (const p of payments) {
      const amount = Number(p.amount);

      if (p.status === 'PAID' || p.status === 'PARTIAL') {
        totalRevenue += amount;
        paymentCount += 1;
        byCategory[p.category] += amount;
        byMethod[p.method] += amount;

        // Kunlik breakdown
        const dateKey = p.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
        byDayMap[dateKey] = (byDayMap[dateKey] ?? 0) + amount;
      }

      if (p.status === 'PENDING') {
        totalPending += amount;
      }
    }

    // byDay — sanalar bo'yicha tartiblangan massiv
    const byDay = Object.entries(byDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    return NextResponse.json({
      totalRevenue,
      totalPending,
      byCategory,
      byMethod,
      byDay,
      paymentCount,
    });
  } catch (error) {
    console.error('[reports/financial]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
