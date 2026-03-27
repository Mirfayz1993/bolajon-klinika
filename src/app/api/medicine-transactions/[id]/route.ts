import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const transaction = await prisma.medicineTransaction.findUnique({
      where: { id },
      include: {
        medicine: {
          include: {
            supplier: { select: { id: true, name: true, phone: true } },
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fatherName: true,
            phone: true,
          },
        },
        admission: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Tranzaksiya topilmadi' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
