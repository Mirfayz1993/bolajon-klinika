import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { vitalCreateSchema } from '@/lib/schemas';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id: admissionId } = await params;

  try {
    const vitals = await prisma.vital.findMany({
      where: { admissionId },
      orderBy: { createdAt: 'desc' },
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
      },
    });
    return NextResponse.json(vitals);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/patients:add_vital');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: admissionId } = await params;

  try {
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, patientId: true },
    });
    if (!admission) return NextResponse.json({ error: 'Statsionar topilmadi' }, { status: 404 });

    const parsed = await validateBody(req, vitalCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const vital = await prisma.vital.create({
      data: {
        patientId: admission.patientId,
        admissionId,
        temperature: body.temperature,
        bloodPressureSystolic: body.bloodPressureSystolic,
        bloodPressureDiastolic: body.bloodPressureDiastolic,
        pulse: body.pulse,
        oxygenSaturation: body.oxygenSaturation,
        weight: body.weight,
        notes: body.notes,
        recordedById: session.user.id,
      },
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(vital, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
