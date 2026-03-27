import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus, PaymentCategory, PaymentStatus, Prisma } from '@prisma/client';

// 12-soat qoidasi: agar yotish 12 soatdan kam bo'lsa — 0 kun hisoblanadi
function calculateInpatientDays(admission: Date, discharge: Date): number {
  const hours = (discharge.getTime() - admission.getTime()) / (1000 * 60 * 60);
  if (hours <= 12) return 0;
  return Math.ceil(hours / 24);
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactionOps: Prisma.PrismaPromise<any>[] = [
      prisma.admission.update({
        where: { id },
        data: {
          dischargeDate: dischargeAt,
          notes: updatedNotes,
        },
      }),
      prisma.bed.update({
        where: { id: admission.bed.id },
        data: { status: BedStatus.AVAILABLE },
      }),
    ];

    if (days > 0) {
      const amount = Number(admission.dailyRate) * days;
      transactionOps.push(
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
        })
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await prisma.$transaction(transactionOps) as any[];

    const updatedAdmission = results[0];
    const payment = days > 0 ? results[2] : null;

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
