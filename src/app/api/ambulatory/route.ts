import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BedStatus, AdmissionType } from '@prisma/client';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
  const auth = await requireAction('/ambulatory:create');
  if (!auth.ok) return auth.response;

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
      prisma.bed.findFirst({
        where: { id: bedId, deletedAt: null, room: { deletedAt: null } },
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

    // Bemorning boshqa aktiv ambulator yotqizishi bor-yo'qligini tekshirish
    const activePatientAdmission = await prisma.admission.findFirst({
      where: {
        patientId,
        dischargeDate: null,
        admissionType: AdmissionType.AMBULATORY,
      },
      include: { bed: { select: { bedNumber: true, room: { select: { roomNumber: true } } } } },
    });
    if (activePatientAdmission) {
      const loc = `${activePatientAdmission.bed.room.roomNumber}-xona, ${activePatientAdmission.bed.bedNumber}-karavot`;
      return NextResponse.json(
        { error: `Bu bemor allaqachon ambulator bo'limida yotibdi (${loc}). Avval uni chiqaring.` },
        { status: 400 }
      );
    }

    // To'shakda allaqachon aktiv yotqizish bor-yo'qligini tekshirish
    const activeBedAdmission = await prisma.admission.findFirst({
      where: { bedId, dischargeDate: null },
    });
    if (activeBedAdmission) {
      return NextResponse.json(
        { error: "Bu to'shakda allaqachon aktiv bemor mavjud. Avval uni chiqaring." },
        { status: 400 }
      );
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
