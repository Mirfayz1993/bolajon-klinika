import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LabTestStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');
    const testIdsParam = searchParams.get('testIds');
    const date = searchParams.get('date');

    if (!patientId) return NextResponse.json({ error: 'patientId majburiy' }, { status: 400 });

    const where: {
      patientId: string;
      status: LabTestStatus;
      id?: { in: string[] };
      completedAt?: { gte: Date; lte: Date };
    } = {
      patientId,
      status: LabTestStatus.COMPLETED,
    };

    if (testIdsParam) {
      const ids = testIdsParam.split(',').filter(Boolean);
      where.id = { in: ids };
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.completedAt = { gte: start, lte: end };
    }

    const tests = await prisma.labTest.findMany({
      where,
      include: {
        testType: {
          select: {
            id: true, name: true, normalRange: true, unit: true, category: true,
            parentId: true,
            children: {
              select: { id: true, name: true, normalRange: true, unit: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        patient: {
          select: { id: true, firstName: true, lastName: true, fatherName: true, birthDate: true, gender: true },
        },
        labTech: {
          select: { id: true, name: true },
        },
      },
      orderBy: { testType: { createdAt: 'asc' } },
    });

    // Guruhlab chiqarish
    const grouped: Record<string, {
      category: string;
      tests: Array<{
        id: string;
        name: string;
        result: unknown;
        normalRange: string | null;
        unit: string | null;
        completedAt: Date | null;
      }>;
    }> = {};

    for (const t of tests) {
      const isPanel = t.testType.children.length > 0;
      const cat = t.testType.category ?? 'BOSHQA';
      if (!grouped[cat]) grouped[cat] = { category: cat, tests: [] };

      if (isPanel) {
        // Expand panel results: each child becomes a row
        const results = t.results as Record<string, string> | null ?? {};
        for (const child of t.testType.children) {
          const val = results[child.id];
          if (val?.trim()) {
            grouped[cat].tests.push({
              id: `${t.id}_${child.id}`,
              name: child.name,
              result: { value: val },
              normalRange: child.normalRange,
              unit: child.unit,
              completedAt: t.completedAt,
            });
          }
        }
      } else {
        // Individual test
        grouped[cat].tests.push({
          id: t.id,
          name: t.testType.name,
          result: t.results,
          normalRange: t.testType.normalRange,
          unit: t.testType.unit,
          completedAt: t.completedAt,
        });
      }
    }

    // Remove empty groups (panels with no filled values)
    const groups = Object.values(grouped).filter(g => g.tests.length > 0);

    const patient = tests[0]?.patient ?? null;

    return NextResponse.json({
      patient,
      groups,
      printedAt: new Date().toISOString(),
      labTech: tests[0]?.labTech ?? null,
    });
  } catch (err) {
    console.error('[lab/print GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
