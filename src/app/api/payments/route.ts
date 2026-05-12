import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentMethod, PaymentCategory, PaymentStatus } from '@prisma/client';
import { requireAction } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await requireAction('/payments:see_all');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);

    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status') as PaymentStatus | null;
    const category = searchParams.get('category') as PaymentCategory | null;
    const method = searchParams.get('method') as PaymentMethod | null;
    const doctorId = searchParams.get('doctorId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: {
      patientId?: string;
      status?: PaymentStatus;
      category?: PaymentCategory;
      method?: PaymentMethod;
      appointment?: { is: { doctorId: string } };
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {};

    if (patientId) where.patientId = patientId;
    if (status && Object.values(PaymentStatus).includes(status)) where.status = status;
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

    const [payments, total, aggregate] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: { firstName: true, lastName: true },
          },
          appointment: {
            select: {
              id: true,
              type: true,
              doctor: { select: { id: true, name: true, role: true } },
            },
          },
          admission: {
            select: { id: true },
          },
          receivedBy: {
            select: { id: true, name: true, role: true },
          },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where: { ...where, status: { in: ['PAID', 'PARTIAL'] } },
        _sum: { amount: true },
      }),
    ]);

    const data = payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));

    const totalAmount = Number(aggregate._sum.amount ?? 0);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ data, total, totalAmount, page, limit, totalPages });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/payments:create');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = await req.json() as {
      patientId?: string;
      amount?: number;
      method?: PaymentMethod;
      category?: PaymentCategory;
      status?: PaymentStatus;
      appointmentId?: string;
      admissionId?: string;
      description?: string;
    };

    const { patientId, amount, method, category, status, appointmentId, admissionId, description } = body;

    if (!patientId || amount === undefined || !method || !category) {
      return NextResponse.json(
        { error: 'patientId, amount, method, category majburiy' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'amount 0 dan katta bo\'lishi kerak' },
        { status: 400 }
      );
    }

    if (!Object.values(PaymentMethod).includes(method)) {
      return NextResponse.json({ error: 'method noto\'g\'ri' }, { status: 400 });
    }

    if (!Object.values(PaymentCategory).includes(category)) {
      return NextResponse.json({ error: 'category noto\'g\'ri' }, { status: 400 });
    }

    if (status && !Object.values(PaymentStatus).includes(status)) {
      return NextResponse.json({ error: 'status noto\'g\'ri' }, { status: 400 });
    }

    const patientExists = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patientExists) {
      return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
    }

    const payment = await prisma.payment.create({
      data: {
        patientId,
        amount,
        method,
        category,
        status: status ?? PaymentStatus.PAID,
        appointmentId: appointmentId ?? undefined,
        admissionId: admissionId ?? undefined,
        description: description ?? undefined,
        receivedById: session.user.id,
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true },
        },
        appointment: {
          select: {
            id: true,
            type: true,
            doctor: { select: { id: true, name: true, role: true } },
          },
        },
        admission: {
          select: { id: true },
        },
        receivedBy: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: 'CREATE',
      module: 'payments',
      details: {
        paymentId: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        category: payment.category,
        status: payment.status,
        patientId: payment.patientId,
      },
    });

    return NextResponse.json(
      { ...payment, amount: Number(payment.amount) },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
