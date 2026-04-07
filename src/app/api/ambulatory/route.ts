import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus, AdmissionType } from '@prisma/client';

const WRITE_ROLES = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE', 'RECEPTIONIST', 'NURSE'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status'); // ACTIVE | DISCHARGED

    const where: Record<string, unknown> = {
      admissionType: AdmissionType.AMBULATORY,
    };

    if (statusParam === 'ACTIVE') {
      where.dischargeDate = null;
    } else if (statusParam === 'DISCHARGED') {
      where.dischargeDate = { not: null };
    }

    const data = await prisma.admission.findMany({
      where,
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, fatherName: true, phone: true },
        },
        bed: {
          select: {
            id: true,
            bedNumber: true,
            room: { select: { id: true, roomNumber: true, floor: true } },
          },
        },
      },
      orderBy: { admissionDate: 'desc' },
    });

    const result = data.map((a) => ({
      ...a,
      status: a.dischargeDate ? 'DISCHARGED' : 'ACTIVE',
      admittedAt: a.admissionDate,
      dischargedAt: a.dischargeDate,
      diagnosis: a.notes ?? null,
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!WRITE_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      patientId?: string;
      bedId?: string;
      prescriptionId?: string;
      notes?: string;
    };

    const { patientId, bedId, prescriptionId, notes } = body;

    if (!patientId || !bedId) {
      return NextResponse.json({ error: 'patientId va bedId majburiy' }, { status: 400 });
    }

    const [patient, bed] = await Promise.all([
      prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } }),
      prisma.bed.findUnique({
        where: { id: bedId },
        include: { room: { select: { isAmbulatory: true, floor: true } } },
      }),
    ]);

    if (!patient) return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
    if (!bed) return NextResponse.json({ error: "To'shak topilmadi" }, { status: 404 });
    if (!bed.room.isAmbulatory) {
      return NextResponse.json({ error: 'Bu to\'shak ambulator bo\'limiga tegishli emas' }, { status: 400 });
    }
    if (bed.status !== BedStatus.AVAILABLE) {
      return NextResponse.json({ error: "To'shak band" }, { status: 400 });
    }

    const [admission] = await prisma.$transaction([
      prisma.admission.create({
        data: {
          patientId,
          bedId,
          admissionType: AdmissionType.AMBULATORY,
          dailyRate: 0,
          prescriptionId: prescriptionId ?? undefined,
          notes: notes ?? undefined,
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, fatherName: true } },
          bed: {
            select: {
              id: true,
              bedNumber: true,
              room: { select: { id: true, roomNumber: true, floor: true } },
            },
          },
        },
      }),
      prisma.bed.update({
        where: { id: bedId },
        data: { status: BedStatus.OCCUPIED },
      }),
    ]);

    return NextResponse.json(admission, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
