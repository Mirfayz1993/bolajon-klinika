import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

const VIEW_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.HEAD_NURSE];
const CREATE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!VIEW_ROLES.includes(session.user.role as Role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const medicalRecord = await prisma.medicalRecord.findUnique({ where: { id } });
    if (!medicalRecord) {
      return NextResponse.json({ error: 'MedicalRecord topilmadi' }, { status: 404 });
    }

    const prescriptions = await prisma.prescription.findMany({
      where: { medicalRecordId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(prescriptions);
  } catch (error) {
    console.error('[GET /api/medical-records/[id]/prescriptions]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CREATE_ROLES.includes(session.user.role as Role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const medicalRecord = await prisma.medicalRecord.findUnique({ where: { id } });
    if (!medicalRecord) {
      return NextResponse.json({ error: 'MedicalRecord topilmadi' }, { status: 404 });
    }

    const body = await req.json();
    const { medicineName, dosage, duration, instructions } = body;

    if (!medicineName || !dosage || !duration) {
      return NextResponse.json(
        { error: 'medicineName, dosage va duration majburiy' },
        { status: 400 }
      );
    }

    const prescription = await prisma.prescription.create({
      data: {
        medicalRecordId: id,
        medicineName,
        dosage,
        duration,
        instructions: instructions ?? null,
      },
    });

    return NextResponse.json(prescription, { status: 201 });
  } catch (error) {
    console.error('[POST /api/medical-records/[id]/prescriptions]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
