import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus, Prisma } from '@prisma/client';

const ALLOWED_ROLES = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const patientId = searchParams.get('patientId');
    const admissionTypeParam = searchParams.get('admissionType');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AdmissionWhereInput = {};

    if (patientId) where.patientId = patientId;

    if (admissionTypeParam === 'INPATIENT') where.admissionType = 'INPATIENT';
    else if (admissionTypeParam === 'AMBULATORY') where.admissionType = 'AMBULATORY';

    if (statusParam === 'ACTIVE') {
      where.dischargeDate = null;
    } else if (statusParam === 'DISCHARGED') {
      where.dischargeDate = { not: null };
    }

    const [data, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true, fatherName: true },
          },
          bed: {
            select: {
              id: true,
              bedNumber: true,
              room: {
                select: { id: true, roomNumber: true, floor: true },
              },
            },
          },
        },
        orderBy: { admissionDate: 'desc' },
      }),
      prisma.admission.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ data, total, page, limit, totalPages });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      patientId?: string;
      bedId?: string;
      doctorId?: string;
      diagnosis?: string;
      dailyRate?: number;
    };

    const { patientId, bedId, diagnosis, dailyRate } = body;

    if (!patientId || !bedId || !dailyRate) {
      return NextResponse.json(
        { error: 'patientId, bedId va dailyRate majburiy' },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
    }

    const bed = await prisma.bed.findUnique({
      where: { id: bedId },
      include: { room: { select: { floor: true, isAmbulatory: true } } },
    });
    if (!bed) {
      return NextResponse.json({ error: 'To\'shak topilmadi' }, { status: 404 });
    }

    if (bed.room.floor !== 4 || bed.room.isAmbulatory) {
      return NextResponse.json(
        { error: 'Statsionar bemorlar faqat 4-qavatdagi xonalarga yotqizilishi mumkin' },
        { status: 400 }
      );
    }

    if (bed.status !== BedStatus.AVAILABLE) {
      return NextResponse.json(
        { error: 'To\'shak band yoki ta\'mirda. Faqat AVAILABLE to\'shakka yotqizish mumkin' },
        { status: 400 }
      );
    }

    const activeAdmission = await prisma.admission.findFirst({
      where: { patientId, dischargeDate: null },
    });
    if (activeAdmission) {
      return NextResponse.json(
        { error: 'Bemorning allaqachon faol yotqizishi mavjud' },
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
          dailyRate,
          notes: diagnosis ?? undefined,
        },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
          bed: {
            select: {
              id: true,
              bedNumber: true,
              room: {
                select: { id: true, roomNumber: true, floor: true },
              },
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
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
