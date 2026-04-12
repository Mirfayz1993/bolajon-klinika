import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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

  const allowedRoles = ['ADMIN', 'HEAD_LAB_TECH', 'LAB_TECH'];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isHeadLabTech = session.user.role === 'HEAD_LAB_TECH' || session.user.role === 'ADMIN';

  try {
    const { id } = await params;

    const existing = await prisma.labTest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tahlil topilmadi' }, { status: 404 });
    }

    // Only HEAD_LAB_TECH/ADMIN can edit already COMPLETED tests
    if (existing.status === 'COMPLETED' && !isHeadLabTech) {
      return NextResponse.json({ error: 'Faqat Bosh laborant natijani o\'zgartira oladi' }, { status: 403 });
    }

    const body = await req.json() as {
      result?: string;
    };

    if (!body.result || !body.result.trim()) {
      return NextResponse.json({ error: 'Natija majburiy' }, { status: 400 });
    }

    const newValue = body.result.trim();

    // Build change history in notes
    type HistoryEntry = { date: string; from: string | null; to: string; by: string };
    let history: HistoryEntry[] = [];
    if (existing.notes) {
      try { history = JSON.parse(existing.notes) as HistoryEntry[]; } catch { history = []; }
    }
    const existingResults = existing.results as Record<string, unknown> | null;
    const prevValue = existingResults?.value != null ? String(existingResults.value) : null;

    history.push({
      date: new Date().toISOString(),
      from: prevValue,
      to: newValue,
      by: session.user.name ?? session.user.id,
    });

    const updated = await prisma.labTest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: existing.completedAt ?? new Date(),
        results: { value: newValue } as Prisma.InputJsonValue,
        notes: JSON.stringify(history),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        testType: { select: { id: true, name: true, price: true, normalRange: true, unit: true } },
        labTech: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
