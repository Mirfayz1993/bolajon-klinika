import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10) || 50);

    const prescriptions = await prisma.prescription.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        medicalRecord: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, fatherName: true } },
            doctor: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    return NextResponse.json(prescriptions);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
