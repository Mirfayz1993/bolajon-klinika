import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AdmissionType } from '@prisma/client';
import { requireSession } from '@/lib/api-auth';

// POST /api/ambulatory/qr-scan
// Body: { patientId: string }
// Hamshira bemorning QR kodini skanerlaydi:
//   PENDING admission → ACTIVE + bed.OCCUPIED
//   ACTIVE admission  → DISCHARGED + bed.AVAILABLE
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const body = await req.json() as { patientId?: string };
  if (!body.patientId?.trim()) {
    return NextResponse.json({ error: 'patientId majburiy' }, { status: 400 });
  }

  const patientId = body.patientId.trim();

  try {
    // 1. PENDING admission bor mi?
    const pendingAdmission = await prisma.admission.findFirst({
      where: {
        patientId,
        admissionType: AdmissionType.AMBULATORY,
        status: 'PENDING',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, fatherName: true } },
        bed: {
          include: { room: { select: { id: true, roomNumber: true, floor: true } } },
        },
      },
    });

    if (pendingAdmission) {
      // PENDING → ACTIVE, bed → OCCUPIED
      await prisma.$transaction([
        prisma.admission.update({
          where: { id: pendingAdmission.id },
          data: { status: 'ACTIVE' },
        }),
        prisma.bed.update({
          where: { id: pendingAdmission.bedId },
          data: { status: 'OCCUPIED' },
        }),
      ]);

      return NextResponse.json({
        action: 'checked_in',
        message: `Bemor qabul qilindi: ${pendingAdmission.patient.lastName} ${pendingAdmission.patient.firstName} → Xona ${pendingAdmission.bed.room.roomNumber} / To'shak ${pendingAdmission.bed.bedNumber}`,
        admission: {
          id: pendingAdmission.id,
          patient: pendingAdmission.patient,
          bed: pendingAdmission.bed,
          status: 'ACTIVE',
        },
      });
    }

    // 2. ACTIVE admission bor mi?
    const activeAdmission = await prisma.admission.findFirst({
      where: {
        patientId,
        admissionType: AdmissionType.AMBULATORY,
        status: 'ACTIVE',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, fatherName: true } },
        bed: {
          include: { room: { select: { id: true, roomNumber: true, floor: true } } },
        },
      },
    });

    if (activeAdmission) {
      // ACTIVE → DISCHARGED, bed → AVAILABLE
      await prisma.$transaction([
        prisma.admission.update({
          where: { id: activeAdmission.id },
          data: { status: 'DISCHARGED', dischargeDate: new Date() },
        }),
        prisma.bed.update({
          where: { id: activeAdmission.bedId },
          data: { status: 'AVAILABLE' },
        }),
      ]);

      return NextResponse.json({
        action: 'discharged',
        message: `Muolaja tugadi: ${activeAdmission.patient.lastName} ${activeAdmission.patient.firstName}`,
        admission: {
          id: activeAdmission.id,
          patient: activeAdmission.patient,
          bed: activeAdmission.bed,
          status: 'DISCHARGED',
        },
      });
    }

    return NextResponse.json(
      { error: 'Bemor uchun aktiv yoki kutayotgan ambulator yozuv topilmadi' },
      { status: 404 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
