import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ALLOWED = ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE'];
  if (!ALLOWED.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
