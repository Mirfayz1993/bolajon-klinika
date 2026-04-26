import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
