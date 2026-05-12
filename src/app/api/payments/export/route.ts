import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentMethod, PaymentCategory } from '@prisma/client';
import { requireAction } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAction('/payments:see_all');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);

    const patientId = searchParams.get('patientId');
    const doctorId = searchParams.get('doctorId');
    const category = searchParams.get('category') as PaymentCategory | null;
    const method = searchParams.get('method') as PaymentMethod | null;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: {
      patientId?: string;
      category?: PaymentCategory;
      method?: PaymentMethod;
      appointment?: { is: { doctorId: string } };
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (patientId) where.patientId = patientId;
    if (category && Object.values(PaymentCategory).includes(category)) where.category = category;
    if (method && Object.values(PaymentMethod).includes(method)) where.method = method;
    if (doctorId) where.appointment = { is: { doctorId } };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (!isNaN(from.getTime())) where.createdAt.gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (!isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          where.createdAt.lte = to;
        }
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        appointment: {
          select: { doctor: { select: { name: true } } },
        },
        receivedBy: { select: { name: true } },
      },
    });

    const CAT_LABELS: Record<string, string> = {
      CHECKUP: "Shifokor ko'rigi",
      LAB_TEST: 'Laboratoriya',
      SPEECH_THERAPY: 'Logopediya',
      MASSAGE: 'Massaj',
      TREATMENT: 'Muolaja',
      INPATIENT: 'Statsionar',
      AMBULATORY: 'Ambulator',
    };

    const METHOD_LABELS: Record<string, string> = {
      CASH: 'Naqd',
      CARD: 'Karta',
      BANK_TRANSFER: 'Bank',
      CLICK: 'Click',
      PAYME: 'Payme',
    };

    const STATUS_LABELS: Record<string, string> = {
      PAID: "To'langan",
      PENDING: 'Kutilmoqda',
      PARTIAL: 'Qisman',
      CANCELLED: 'Bekor',
      REFUNDED: 'Qaytarilgan',
    };

    const headers = ['#', 'Bemor', 'Miqdor', "To'lov usuli", 'Kategoriya', 'Shifokor', 'Holat', 'Sana', 'Qabul qiluvchi'];

    const rows = payments.map((p, i) => [
      String(i + 1),
      `${p.patient.lastName} ${p.patient.firstName}`,
      String(Number(p.amount)),
      METHOD_LABELS[p.method] ?? p.method,
      CAT_LABELS[p.category] ?? p.category,
      p.appointment?.doctor?.name ?? '',
      STATUS_LABELS[p.status] ?? p.status,
      new Date(p.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }),
      p.receivedBy?.name ?? '',
    ]);

    function csvEscape(value: string): string {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    // BOM qo'shish — Excel UTF-8'ni to'g'ri o'qishi uchun
    const bom = '﻿';

    const filename = `paymentlar_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
