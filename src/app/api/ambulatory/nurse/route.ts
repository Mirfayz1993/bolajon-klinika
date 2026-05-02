import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AdmissionType } from '@prisma/client';
import { requireSession } from '@/lib/api-auth';

// GET /api/ambulatory/nurse
// Hamshira uchun: PENDING va ACTIVE ambulator bemorlar ro'yxati
// PENDING birinchi, keyin ACTIVE, createdAt bo'yicha tartib
export async function GET(_req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const admissions = await prisma.admission.findMany({
      where: {
        admissionType: AdmissionType.AMBULATORY,
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
        assignedServices: {
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
