import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';
import { requireAction, requireSession } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { writeAuditLog } from '@/lib/audit';
import { z } from 'zod';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAID', 'PARTIAL', 'CANCELLED'],
  PARTIAL: ['PAID', 'CANCELLED'],
  PAID: ['REFUNDED', 'CANCELLED'],
  CANCELLED: [],
  REFUNDED: [],
};

const paymentUpdateSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  description: z.string().trim().max(2000).optional(),
  confirmedFullPayment: z.boolean().optional(),
}).refine((d) => d.status !== undefined || d.description !== undefined, {
  message: 'Kamida status yoki description kerak',
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
  const auth = await requireAction('/payments:edit');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await params;

    const parsed = await validateBody(req, paymentUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { status, description } = body;

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

    await writeAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      module: 'payments',
      details: {
        paymentId: id,
        oldStatus: existing.status,
        newStatus: updated.status,
        oldAmount: Number(existing.amount),
        newAmount: Number(updated.amount),
        description: updated.description,
      },
    });

    return NextResponse.json({ ...updated, amount: Number(updated.amount) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
