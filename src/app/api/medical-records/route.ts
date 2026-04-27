import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyAction, requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId') || undefined;
    const doctorId = searchParams.get('doctorId') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: { patientId?: string; doctorId?: string } = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;

    const [data, total] = await Promise.all([
      prisma.medicalRecord.findMany({
        where,
        include: {
          patient: { select: { firstName: true, lastName: true } },
          doctor: { select: { name: true, role: true } },
          prescriptions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.medicalRecord.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ data, total, page, limit, totalPages });
  } catch (error) {
    console.error('[GET /api/medical-records]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAnyAction('/patients:create_note', '/medical-records:create');
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { patientId, doctorId, diagnosis, treatment, notes } = body;

    if (!patientId || !doctorId) {
      return NextResponse.json(
        { error: 'patientId va doctorId majburiy' },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: 'Patient topilmadi' }, { status: 404 });
    }

    const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor topilmadi' }, { status: 404 });
    }

    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        patientId,
        doctorId,
        diagnosis: diagnosis ?? null,
        treatment: treatment ?? null,
        notes: notes ?? null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { name: true, role: true } },
        prescriptions: true,
      },
    });

    return NextResponse.json(medicalRecord, { status: 201 });
  } catch (error) {
    console.error('[POST /api/medical-records]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
