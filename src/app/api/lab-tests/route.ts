import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LabTestStatus, Role, PaymentMethod } from '@prisma/client';

const READ_ROLES: Role[] = [
  Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.HEAD_NURSE, Role.NURSE,
  Role.HEAD_LAB_TECH, Role.LAB_TECH, Role.RECEPTIONIST,
  Role.SPEECH_THERAPIST, Role.MASSAGE_THERAPIST, Role.SANITARY_WORKER,
];
const ORDER_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.RECEPTIONIST];

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
            select: {
              id: true, name: true, price: true, normalRange: true, normalMin: true, normalMax: true, unit: true, category: true,
              parentId: true,
              children: { select: { id: true, name: true, normalRange: true, normalMin: true, normalMax: true, unit: true, price: true }, orderBy: { name: 'asc' } },
            },
          },
          labTech: {
            select: { id: true, name: true },
          },
          payment: {
            select: { id: true, status: true, amount: true },
          },
        },
      }),
      prisma.labTest.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Normalize `results` JSON to a flat `result` string for frontend
    const normalized = data.map((item) => {
      const r = item.results as Record<string, unknown> | null;
      const children = item.testType.children ?? [];
      const isPanel = children.length > 0;

      let resultStr: string | null = null;
      if (r) {
        if (isPanel) {
          const filled = children.filter(c => (r[c.id] as string)?.trim()).length;
          resultStr = `${filled}/${children.length} ta`;
        } else if (typeof r.value === 'string' || typeof r.value === 'number') {
          resultStr = String(r.value);
        } else {
          resultStr = JSON.stringify(r);
        }
      }
      return { ...item, result: resultStr };
    });

    return NextResponse.json({ data: normalized, total, page, limit, totalPages });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORDER_ROLES.includes(session.user.role as Role)) {
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
      prisma.labTestType.findUnique({
        where: { id: testTypeId },
        include: { children: { select: { id: true } } },
      }),
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

    const isPanel = testType.children.length > 0;

    // Duplikat tekshiruvi: shu bemor + shu tahlil turi PENDING/IN_PROGRESS bo'lsa, qaytadan yaratma
    const existing = await prisma.labTest.findFirst({
      where: {
        patientId,
        testTypeId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Bu tahlil ushbu bemor uchun allaqachon buyurtma qilingan va natija kutilmoqda' },
        { status: 409 }
      );
    }

    // For panels: initial results = empty strings keyed by child IDs
    const initialResults = isPanel
      ? Object.fromEntries(testType.children.map(c => [c.id, '']))
      : undefined;

    const { labTest, payment } = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.create({
        data: {
          patientId,
          amount: testType.price,
          method: paymentMethod as PaymentMethod,
          category: 'LAB_TEST',
          status: 'PENDING',
          description: testType.name,
        },
      });

      const lt = await tx.labTest.create({
        data: {
          patientId,
          testTypeId,
          labTechId: session.user.id,
          notes: notes ?? undefined,
          status: 'PENDING',
          paymentId: pay.id,
          ...(isPanel && { results: initialResults }),
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          testType: {
            select: {
              id: true, name: true, price: true, normalRange: true, unit: true, category: true,
              parentId: true,
              children: { select: { id: true, name: true, normalRange: true, unit: true, price: true }, orderBy: { createdAt: 'asc' } },
            },
          },
          labTech: { select: { id: true, name: true } },
          payment: { select: { id: true, status: true, amount: true } },
        },
      });

      // AssignedService yaratamiz — Xizmatlar tabida ko'rinishi uchun
      await tx.assignedService.create({
        data: {
          patientId,
          categoryName: 'Laboratoriya',
          itemName: testType.name,
          price: testType.price,
          itemId: testTypeId,
          assignedById: session.user.id,
        },
      });

      return { labTest: lt, payment: pay };
    });

    return NextResponse.json({ labTest, payment }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
