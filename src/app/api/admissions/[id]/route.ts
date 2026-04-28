import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateInpatientDays } from '@/lib/business-logic';
import { requireAnyAction, requireSession } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { admissionUpdateSchema } from '@/lib/schemas';
import { writeAuditLog } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const admission = await prisma.admission.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fatherName: true,
            phone: true,
            birthDate: true,
          },
        },
        bed: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!admission) {
      return NextResponse.json({ error: 'Yotqizish topilmadi' }, { status: 404 });
    }

    // Compute live cost for active admissions
    const now = admission.dischargeDate ?? new Date();
    const currentHours = (now.getTime() - admission.admissionDate.getTime()) / (1000 * 60 * 60);
    const currentDays = calculateInpatientDays(admission.admissionDate, now);
    const currentAmount = currentDays * Number(admission.dailyRate);

    return NextResponse.json({ ...admission, currentHours: Math.floor(currentHours), currentDays, currentAmount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAnyAction('/admissions:edit_rate', '/admissions:create');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await params;

    const existing = await prisma.admission.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Yotqizish topilmadi' }, { status: 404 });
    }

    if (existing.dischargeDate !== null) {
      return NextResponse.json(
        { error: 'Chiqarilgan yotqizishni tahrirlash mumkin emas' },
        { status: 400 }
      );
    }

    const parsed = await validateBody(req, admissionUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const { diagnosis, notes, dailyRate } = parsed.data;

    const updateData: { notes?: string; dailyRate?: number } = {};

    // diagnosis and notes both map to the notes field in schema
    if (diagnosis !== undefined) updateData.notes = diagnosis;
    else if (notes !== undefined) updateData.notes = notes;

    const oldRate = Number(existing.dailyRate);
    const rateChanged = dailyRate !== undefined && dailyRate !== oldRate;
    if (dailyRate !== undefined) {
      updateData.dailyRate = dailyRate;
    }

    const admission = await prisma.admission.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        bed: {
          include: { room: true },
        },
      },
    });

    // Audit log — rate o'zgarishi alohida yoziladi
    if (rateChanged) {
      await writeAuditLog({
        userId: session.user.id,
        action: 'UPDATE_RATE',
        module: 'admissions',
        details: {
          admissionId: id,
          patientId: existing.patientId,
          oldRate,
          newRate: dailyRate,
        },
      });
    }

    // Diagnosis/notes o'zgarishi alohida audit
    if (updateData.notes !== undefined && updateData.notes !== existing.notes) {
      await writeAuditLog({
        userId: session.user.id,
        action: 'UPDATE',
        module: 'admissions',
        details: {
          admissionId: id,
          patientId: existing.patientId,
          field: diagnosis !== undefined ? 'diagnosis' : 'notes',
        },
      });
    }

    return NextResponse.json(admission);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
