import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus } from '@prisma/client';
import type { Admission } from '@prisma/client';
import { calculateInpatientDays } from '@/lib/business-logic';
import { writeAuditLog } from '@/lib/audit';

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

    // Shu to'shakda boshqa aktiv admission bor-yo'qligini tekshirish
    const otherActiveCount = await prisma.admission.count({
      where: { bedId: admission.bed.id, dischargeDate: null, id: { not: id } },
    });
    const shouldFreeBed = otherActiveCount === 0;

    const days = calculateInpatientDays(admission.admissionDate, dischargeAt);
    const hours = Math.floor(
      (dischargeAt.getTime() - admission.admissionDate.getTime()) / (1000 * 60 * 60)
    );

    const updatedNotes = dischargeNotes
      ? `${admission.notes ? admission.notes + '\n' : ''}Chiqish izohi: ${dischargeNotes}`
      : admission.notes ?? undefined;

    let updatedAdmission: Admission;
    let serviceAmount: number | null = null;

    if (days > 0) {
      const amount = Number(admission.dailyRate) * days;
      const description = `Statsionar: ${days} kun (${hours} soat)`;

      const [discharged] = await prisma.$transaction([
        prisma.admission.update({
          where: { id },
          data: { dischargeDate: dischargeAt, notes: updatedNotes },
        }),
        prisma.bed.update({
          where: { id: admission.bed.id },
          data: { status: shouldFreeBed ? BedStatus.AVAILABLE : BedStatus.OCCUPIED },
        }),
        // AssignedService yaratish — qabulxona Xizmatlar bo'limida ko'rib to'laydi
        prisma.assignedService.create({
          data: {
            patientId: admission.patientId,
            categoryName: 'Statsionar',
            itemName: description,
            price: amount,
            isPaid: false,
            assignedById: session.user.id,
            admissionId: admission.id,
          },
        }),
      ]);

      updatedAdmission = discharged;
      serviceAmount = amount;
    } else {
      const [discharged] = await prisma.$transaction([
        prisma.admission.update({
          where: { id },
          data: { dischargeDate: dischargeAt, notes: updatedNotes },
        }),
        prisma.bed.update({
          where: { id: admission.bed.id },
          data: { status: shouldFreeBed ? BedStatus.AVAILABLE : BedStatus.OCCUPIED },
        }),
      ]);

      updatedAdmission = discharged;
    }

    await writeAuditLog({
      userId: session.user.id,
      action: 'DISCHARGE',
      module: 'admissions',
      details: {
        admissionId: id,
        patientId: admission.patientId,
        patient: `${admission.patient.lastName} ${admission.patient.firstName}`,
        days,
        amount: serviceAmount,
      },
    });

    return NextResponse.json({
      admission: updatedAdmission,
      days,
      hours,
      payment: serviceAmount !== null ? { amount: serviceAmount } : null,
      free: days === 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
