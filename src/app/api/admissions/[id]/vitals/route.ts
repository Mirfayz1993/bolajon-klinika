import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSession, ROLE_GROUPS } from '@/lib/api-auth';

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
  const auth = await requireRole(ROLE_GROUPS.ALL_MEDICAL);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: admissionId } = await params;

  try {
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, patientId: true },
    });
    if (!admission) return NextResponse.json({ error: 'Statsionar topilmadi' }, { status: 404 });

    const body = await req.json() as {
      temperature?: number;
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      pulse?: number;
      oxygenSaturation?: number;
      weight?: number;
      notes?: string;
    };

    const vital = await prisma.vital.create({
      data: {
        patientId: admission.patientId,
        admissionId,
        temperature: body.temperature ?? undefined,
        bloodPressureSystolic: body.bloodPressureSystolic ?? undefined,
        bloodPressureDiastolic: body.bloodPressureDiastolic ?? undefined,
        pulse: body.pulse ?? undefined,
        oxygenSaturation: body.oxygenSaturation ?? undefined,
        weight: body.weight ?? undefined,
        notes: body.notes ?? undefined,
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
