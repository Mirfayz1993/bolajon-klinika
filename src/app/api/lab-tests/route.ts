import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LabTestStatus, Role, PaymentMethod } from '@prisma/client';

const READ_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.HEAD_LAB_TECH, Role.LAB_TECH];
const WRITE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.HEAD_LAB_TECH, Role.LAB_TECH];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!READ_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');
    const statusParam = searchParams.get('status');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const validStatuses: LabTestStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

    const where: {
      patientId?: string;
      status?: LabTestStatus;
    } = {};

    if (patientId) {
      where.patientId = patientId;
    }

    if (statusParam) {
      if (!validStatuses.includes(statusParam as LabTestStatus)) {
        return NextResponse.json(
          { error: "status noto'g'ri. PENDING, IN_PROGRESS, COMPLETED, CANCELLED bo'lishi kerak" },
          { status: 400 }
        );
      }
      where.status = statusParam as LabTestStatus;
    }

    const [data, total] = await Promise.all([
      prisma.labTest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
          testType: {
            select: { id: true, name: true, price: true },
          },
          labTech: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.labTest.count({ where }),
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
  if (!WRITE_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      patientId?: string;
      testTypeId?: string;
      notes?: string;
      paymentMethod?: PaymentMethod;
    };

    const { patientId, testTypeId, notes } = body;
    const paymentMethod = body.paymentMethod ?? 'CASH';

    if (!patientId || !testTypeId) {
      return NextResponse.json(
        { error: 'patientId va testTypeId majburiy' },
        { status: 400 }
      );
    }

    const [patient, testType] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.labTestType.findUnique({ where: { id: testTypeId } }),
    ]);

    if (!patient) {
      return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
    }
    if (!testType) {
      return NextResponse.json({ error: 'Tahlil turi topilmadi' }, { status: 404 });
    }
    if (!testType.isActive) {
      return NextResponse.json({ error: 'Tahlil turi faol emas' }, { status: 400 });
    }

    const [labTest, payment] = await prisma.$transaction([
      prisma.labTest.create({
        data: {
          patientId,
          testTypeId,
          labTechId: session.user.id,
          notes: notes ?? undefined,
          status: 'PENDING',
        },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
          testType: {
            select: { id: true, name: true, price: true },
          },
          labTech: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.payment.create({
        data: {
          patientId,
          amount: testType.price,
          method: paymentMethod as PaymentMethod,
          category: 'LAB_TEST',
          status: 'PENDING',
          description: testType.name,
        },
      }),
    ]);

    return NextResponse.json({ labTest, payment }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
