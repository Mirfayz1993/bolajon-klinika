import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus, PaymentCategory, PaymentMethod } from '@prisma/client';

const WRITE_ROLES = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE', 'NURSE', 'RECEPTIONIST'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!WRITE_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      paymentAmount?: number;
      paymentMethod?: string;
      notes?: string;
    };

    const admission = await prisma.admission.findUnique({
      where: { id: id },
      include: { bed: true, patient: true },
    });

    if (!admission) {
      return NextResponse.json({ error: 'Yotqizish topilmadi' }, { status: 404 });
    }
    if (admission.dischargeDate) {
      return NextResponse.json({ error: 'Bemor allaqachon chiqarilgan' }, { status: 400 });
    }

    const dischargeDate = new Date();
    const paymentAmount = Number(body.paymentAmount ?? 0);
    const paymentMethod = (body.paymentMethod ?? 'CASH') as PaymentMethod;

    // 1. Discharge admission
    const updateAdmission = prisma.admission.update({
      where: { id: id },
      data: {
        dischargeDate,
        notes: body.notes ? `${admission.notes ?? ''}\n${body.notes}`.trim() : admission.notes,
      },
    });

    // 2. Free the bed
    const freeBed = prisma.bed.update({
      where: { id: admission.bedId },
      data: { status: BedStatus.AVAILABLE },
    });

    // 3. Create payment if amount > 0
    const ops = [updateAdmission, freeBed];

    if (paymentAmount > 0) {
      ops.push(
        prisma.payment.create({
          data: {
            patientId: admission.patientId,
            admissionId: admission.id,
            amount: paymentAmount,
            method: paymentMethod,
            category: PaymentCategory.AMBULATORY,
            description: 'Ambulator muolaja to\'lovi',
          },
        }) as unknown as typeof updateAdmission
      );
    }

    const results = await prisma.$transaction(ops);
    const payment = paymentAmount > 0 ? results[2] : null;

    return NextResponse.json({
      success: true,
      payment: payment ? { amount: paymentAmount } : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
