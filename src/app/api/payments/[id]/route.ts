import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAID', 'PARTIAL', 'CANCELLED'],
  PARTIAL: ['PAID', 'CANCELLED'],
  PAID: ['REFUNDED', 'CANCELLED'],
  CANCELLED: [],
  REFUNDED: [],
};

const ALLOWED_ROLES_FOR_PUT = ['ADMIN', 'HEAD_DOCTOR', 'RECEPTIONIST'];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        patient: {
          select: { firstName: true, lastName: true, fatherName: true, birthDate: true, phone: true },
        },
        appointment: {
          select: { id: true, type: true },
        },
        admission: {
          select: {
            id: true,
            bed: {
              select: {
                bedNumber: true,
                room: { select: { roomNumber: true, floor: true } },
              },
            },
          },
        },
        receivedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'To\'lov topilmadi' }, { status: 404 });
    }

    return NextResponse.json({ ...payment, amount: Number(payment.amount) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as { role?: string }).role ?? '';
  if (!ALLOWED_ROLES_FOR_PUT.includes(userRole)) {
    return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const body = await req.json() as {
      status?: PaymentStatus;
      description?: string;
      confirmedFullPayment?: boolean;
    };

    const { status, description } = body;

    if (status === undefined && description === undefined) {
      return NextResponse.json(
        { error: 'Kamida status yoki description kerak' },
        { status: 400 }
      );
    }

    if (status !== undefined && !Object.values(PaymentStatus).includes(status)) {
      return NextResponse.json({ error: 'status noto\'g\'ri' }, { status: 400 });
    }

    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'To\'lov topilmadi' }, { status: 404 });
    }

    if (status !== undefined) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `${existing.status} → ${status} o'tish mumkin emas` },
          { status: 400 }
        );
      }

      if (existing.status === 'PARTIAL' && status === 'PAID') {
        if (!body.confirmedFullPayment) {
          return NextResponse.json(
            { error: 'To\'liq to\'lov tasdiqlanmagan. confirmedFullPayment: true yuboring' },
            { status: 400 }
          );
        }
      }
    }

    const updateData: { status?: PaymentStatus; description?: string } = {};
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;

    const updated = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: { firstName: true, lastName: true },
        },
        appointment: {
          select: { id: true, type: true },
        },
        admission: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json({ ...updated, amount: Number(updated.amount) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
