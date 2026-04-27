import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const patient = await prisma.patient.findFirst({
      where: { id, deletedAt: null },
    });
    if (!patient) return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });

    // Parallel fetch
    const [medicalRecords, payments, labTests, admissions, appointments] =
      await Promise.all([
        // 1. Doktor tashxislari + retseptlar
        prisma.medicalRecord.findMany({
          where: { patientId: id },
          include: {
            doctor: { select: { id: true, name: true, role: true, specialization: { select: { name: true } } } },
            prescriptions: true,
          },
          orderBy: { createdAt: 'desc' },
        }),

        // 2. To'lovlar
        prisma.payment.findMany({
          where: { patientId: id },
          include: {
            appointment: { select: { type: true, dateTime: true } },
            admission: { select: { admissionType: true, admissionDate: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),

        // 3. Lab tahlillari
        prisma.labTest.findMany({
          where: { patientId: id },
          include: {
            testType: { select: { name: true, unit: true, normalRange: true, price: true } },
            labTech: { select: { name: true, role: true } },
            payment: { select: { id: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),

        // 4. Statsionar / Ambulator yotqizishlar
        prisma.admission.findMany({
          where: { patientId: id },
          include: {
            bed: {
              include: {
                room: { select: { floor: true, roomNumber: true, type: true } },
              },
            },
          },
          orderBy: { admissionDate: 'desc' },
        }),

        // 5. Uchrashuvlar (xizmat tarixi)
        prisma.appointment.findMany({
          where: { patientId: id },
          include: {
            doctor: { select: { name: true, role: true, specialization: { select: { name: true } } } },
          },
          orderBy: { dateTime: 'desc' },
        }),

      ]);

    // Hamshira qaydlari — alohida, xato bo'lsa empty array
    let nurseNotes: unknown[] = [];
    try {
      nurseNotes = await db.nurseNote.findMany({
        where: { patientId: id },
        include: {
          nurse: { select: { name: true, role: true } },
          admission: {
            include: {
              bed: { include: { room: { select: { floor: true, roomNumber: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      // NurseNote hali Prisma client da yo'q — server restart kerak
    }

    return NextResponse.json({
      patient,
      medicalRecords: medicalRecords.map((r) => ({
        ...r,
        // Prisma Decimal -> number
        prescriptions: r.prescriptions,
      })),
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      labTests,
      admissions: admissions.map((a) => ({
        ...a,
        dailyRate: Number(a.dailyRate),
      })),
      appointments,
      nurseNotes,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
