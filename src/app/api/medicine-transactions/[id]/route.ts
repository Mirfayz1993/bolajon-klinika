import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
