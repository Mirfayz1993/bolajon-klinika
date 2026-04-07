import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/ambulatory/nurse
// Hamshira uchun: PENDING va ACTIVE ambulator bemorlar ro'yxati
// PENDING birinchi, keyin ACTIVE, createdAt bo'yicha tartib
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admissions = await prisma.admission.findMany({
      where: {
        admissionType: 'AMBULATORY',
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, fatherName: true, phone: true },
        },
        bed: {
          include: {
            room: { select: { id: true, roomNumber: true, floor: true } },
          },
        },
        nurseNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            nurse: { select: { name: true, role: true } },
          },
        },
        assignedService: {
          include: {
            assignedBy: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    // PENDING ni tepaga chiqarish
    const sorted = [
      ...admissions.filter(a => a.status === 'PENDING'),
      ...admissions.filter(a => a.status === 'ACTIVE'),
    ];

    return NextResponse.json({ data: sorted });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
