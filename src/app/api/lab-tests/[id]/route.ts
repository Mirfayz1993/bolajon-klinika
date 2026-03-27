import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LabTestStatus, Prisma } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<string, LabTestStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const labTest = await prisma.labTest.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fatherName: true,
            phone: true,
            birthDate: true,
          },
        },
        testType: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            normalRange: true,
          },
        },
        labTech: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!labTest) {
      return NextResponse.json({ error: 'Tahlil topilmadi' }, { status: 404 });
    }

    return NextResponse.json(labTest);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowedRoles = ['HEAD_LAB_TECH', 'LAB_TECH'];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.labTest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tahlil topilmadi' }, { status: 404 });
    }

    const body = await req.json() as {
      status?: LabTestStatus;
      results?: Record<string, unknown>;
    };

    const { status, results } = body;

    if (!status && results === undefined) {
      return NextResponse.json(
        { error: 'status yoki results bo\'lishi kerak' },
        { status: 400 }
      );
    }

    const updateData: {
      status?: LabTestStatus;
      results?: Prisma.InputJsonValue;
      completedAt?: Date;
    } = {};

    if (status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed || !allowed.includes(status)) {
        return NextResponse.json(
          {
            error: `Status o'tishi mumkin emas: ${existing.status} → ${status}. Ruxsat etilgan: ${allowed?.join(', ') || 'yo\'q'}`,
          },
          { status: 400 }
        );
      }

      if (status === 'COMPLETED' && results === undefined) {
        return NextResponse.json(
          { error: 'COMPLETED statusida results majburiy' },
          { status: 400 }
        );
      }

      updateData.status = status;

      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    if (results !== undefined) {
      updateData.results = results as Prisma.InputJsonValue;
    }

    const updated = await prisma.labTest.update({
      where: { id },
      data: updateData,
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
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
