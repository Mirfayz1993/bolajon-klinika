import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentMethod, PaymentCategory, PaymentStatus } from '@prisma/client';
import { requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') ?? 'today';

    const now = new Date();
    let dateFrom: Date;

    if (period === 'week') {
      dateFrom = new Date(now);
      dateFrom.setDate(now.getDate() - 6);
      dateFrom.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else {
      // default: today
      dateFrom = new Date(now);
      dateFrom.setHours(0, 0, 0, 0);
    }

    const dateTo = new Date(now);
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
      },
    });

    const totalCount = payments.filter(p => !['CANCELLED', 'REFUNDED'].includes(p.status)).length;

    const byMethod: Record<PaymentMethod, number> = {
      CASH: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
      CLICK: 0,
      PAYME: 0,
    };

    const byCategory: Record<PaymentCategory, number> = {
      CHECKUP: 0,
      LAB_TEST: 0,
      SPEECH_THERAPY: 0,
      MASSAGE: 0,
      TREATMENT: 0,
      INPATIENT: 0,
      AMBULATORY: 0,
    };

    const byStatus: Record<PaymentStatus, number> = {
      PAID: 0,
      PENDING: 0,
      PARTIAL: 0,
      CANCELLED: 0,
      REFUNDED: 0,
    };

    for (const p of payments) {
      // byStatus — barcha statuslar uchun
      byStatus[p.status] += Number(p.amount);

      // byMethod va byCategory — faqat PAID va PARTIAL
      if (p.status === 'PAID' || p.status === 'PARTIAL') {
        byMethod[p.method] += Number(p.amount);
        byCategory[p.category] += Number(p.amount);
      }
    }

    // totalAmount — faqat PAID va PARTIAL
    const totalAmount = payments
      .filter(p => p.status === 'PAID' || p.status === 'PARTIAL')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // byDoctor — appointment bog'langan PAID/PARTIAL to'lovlar shifokor bo'yicha guruhlanadi
    const doctorPayments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        status: { in: ['PAID', 'PARTIAL'] },
        appointment: { isNot: null },
      },
      select: {
        amount: true,
        appointment: {
          select: {
            doctor: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    const doctorMap = new Map<string, { id: string; name: string; role: string; total: number }>();
    for (const p of doctorPayments) {
      const doc = p.appointment?.doctor;
      if (!doc) continue;
      const existing = doctorMap.get(doc.id);
      if (existing) {
        existing.total += Number(p.amount);
      } else {
        doctorMap.set(doc.id, {
          id: doc.id,
          name: doc.name,
          role: doc.role,
          total: Number(p.amount),
        });
      }
    }
    const byDoctor = Array.from(doctorMap.values()).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      totalAmount,
      totalCount,
      byMethod,
      byCategory,
      byStatus,
      byDoctor,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
