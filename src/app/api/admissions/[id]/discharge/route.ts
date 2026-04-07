import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus, PaymentCategory, PaymentStatus } from '@prisma/client';
import type { Admission, Payment } from '@prisma/client';
import { calculateInpatientDays } from '@/lib/business-logic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ALLOWED_ROLES = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE'];
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const admission = await prisma.admission.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        bed: {
          select: { id: true, bedNumber: true },
        },
      },
    });

    if (!admission) {
      return NextResponse.json({ error: 'Yotqizish topilmadi' }, { status: 404 });
    }

    if (admission.dischargeDate !== null) {
      return NextResponse.json(
        { error: 'Bu bemor allaqachon chiqarilgan' },
        { status: 400 }
      );
    }

    const body = await req.json() as {
      dischargeNotes?: string;
    };

    const { dischargeNotes } = body;

    const dischargeAt = new Date();
    const days = calculateInpatientDays(admission.admissionDate, dischargeAt);
    const hours = Math.floor(
      (dischargeAt.getTime() - admission.admissionDate.getTime()) / (1000 * 60 * 60)
    );

    const updatedNotes = dischargeNotes
      ? `${admission.notes ? admission.notes + '\n' : ''}Chiqish izohi: ${dischargeNotes}`
      : admission.notes ?? undefined;

    let updatedAdmission: Admission;
    let payment: Payment | null = null;

    if (days > 0) {
      const amount = Number(admission.dailyRate) * days;

      const [discharged, , createdPayment] = await prisma.$transaction([
        prisma.admission.update({
          where: { id },
          data: { dischargeDate: dischargeAt, notes: updatedNotes },
        }),
        prisma.bed.update({
          where: { id: admission.bed.id },
          data: { status: BedStatus.AVAILABLE },
        }),
        prisma.payment.create({
          data: {
            patientId: admission.patientId,
            admissionId: admission.id,
            amount,
            method: 'CASH',
            category: PaymentCategory.INPATIENT,
            status: PaymentStatus.PENDING,
            description: `Statsionar: ${days} kun (${hours} soat)`,
          },
        }),
      ]);

      updatedAdmission = discharged;
      payment = createdPayment;
    } else {
      const [discharged] = await prisma.$transaction([
        prisma.admission.update({
          where: { id },
          data: { dischargeDate: dischargeAt, notes: updatedNotes },
        }),
        prisma.bed.update({
          where: { id: admission.bed.id },
          data: { status: BedStatus.AVAILABLE },
        }),
      ]);

      updatedAdmission = discharged;
    }

    return NextResponse.json({
      admission: updatedAdmission,
      days,
      hours,
      payment,
      free: days === 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
