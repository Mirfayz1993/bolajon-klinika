import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { doctorNoteCreateSchema } from '@/lib/schemas';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id: admissionId } = await params;

  try {
    const notes = await prisma.medicalRecord.findMany({
      where: { admissionId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: { select: { id: true, name: true, role: true, specialization: { select: { name: true } } } },
        prescriptions: true,
      },
    });
    return NextResponse.json(notes);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/patients:create_note');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: admissionId } = await params;

  try {
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, patientId: true },
    });
    if (!admission) return NextResponse.json({ error: 'Statsionar topilmadi' }, { status: 404 });

    const parsed = await validateBody(req, doctorNoteCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: admission.patientId,
        doctorId: session.user.id,
        admissionId,
        diagnosis: body.diagnosis,
        treatment: body.treatment,
        notes: body.notes,
        prescriptions: body.prescriptions?.length
          ? {
              create: body.prescriptions.map((p) => ({
                medicineName: p.medicineName,
                dosage: p.dosage,
                duration: p.duration,
                instructions: p.instructions,
              })),
            }
          : undefined,
      },
      include: {
        doctor: { select: { id: true, name: true, role: true, specialization: { select: { name: true } } } },
        prescriptions: true,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
