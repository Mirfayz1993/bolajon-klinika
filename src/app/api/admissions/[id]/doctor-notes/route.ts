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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ALLOWED = ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR'];
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
      diagnosis?: string;
      treatment?: string;
      notes?: string;
      prescriptions?: { medicineName: string; dosage: string; duration: string; instructions?: string }[];
    };

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: admission.patientId,
        doctorId: session.user.id,
        admissionId,
        diagnosis: body.diagnosis ?? undefined,
        treatment: body.treatment ?? undefined,
        notes: body.notes ?? undefined,
        prescriptions: body.prescriptions?.length
          ? {
              create: body.prescriptions.map((p) => ({
                medicineName: p.medicineName,
                dosage: p.dosage,
                duration: p.duration,
                instructions: p.instructions ?? undefined,
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
