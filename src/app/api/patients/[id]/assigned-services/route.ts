import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSession } from '@/lib/api-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id: patientId } = await params;

  try {
    const services = await db.assignedService.findMany({
      where: { patientId },
      include: {
        assignedBy: { select: { name: true, role: true } },
        doctor: { select: { name: true, role: true } },
        admission: { select: { bed: { select: { bedNumber: true, room: { select: { roomNumber: true, floor: true } } } } } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    return NextResponse.json(services);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE']);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id: patientId } = await params;
  const body = await req.json() as {
    categoryName: string;
    itemName: string;
    price: number;
    itemId?: string;
    doctorId?: string;
    isUrgent?: boolean;
    bedId?: string;
  };

  if (!body.categoryName?.trim() || !body.itemName?.trim() || body.price === undefined) {
    return NextResponse.json({ error: 'Maydonlar to\'ldirilmagan' }, { status: 400 });
  }

  // Kategoriyalarni aniqlash
  const catLower = body.categoryName.toLowerCase();
  const isAmbulatory = catLower.includes('ambulator');
  const isLabService = catLower.includes('lab') || catLower.includes('laboratoriya') ||
    catLower.includes('labaratoriya') || catLower.includes('tahlil');

  try {
    // Lab xizmat: Payment(PENDING) → LabTest(paymentId) → AssignedService
    if (isLabService && body.itemId) {
      const testType = await db.labTestType.findUnique({
        where: { id: body.itemId },
        include: { children: { select: { id: true } } },
      });
      if (testType && testType.isActive) {
        // Duplikat tekshiruvi: bu bemor uchun shu test allaqachon PENDING/IN_PROGRESS bo'lsa, blokla
        const existingLabTest = await db.labTest.findFirst({
          where: { patientId, testTypeId: body.itemId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        });
        if (existingLabTest) {
          return NextResponse.json(
            { error: 'Bu tahlil ushbu bemor uchun allaqachon buyurtma qilingan va natija kutilmoqda' },
            { status: 409 }
          );
        }

        const isPanel = testType.children.length > 0;
        const initialResults = isPanel
          ? Object.fromEntries(testType.children.map((c: { id: string }) => [c.id, '']))
          : undefined;

        const result = await db.$transaction(async (tx: typeof db) => {
          // 1. PENDING to'lov yaratamiz
          const payment = await tx.payment.create({
            data: {
              patientId,
              amount: body.price,
              method: 'CASH',
              category: 'LAB_TEST',
              status: 'PENDING',
              description: body.itemName.trim(),
            },
          });
          // 2. LabTest ni payment bilan bog'laymiz
          await tx.labTest.create({
            data: {
              patientId,
              testTypeId: body.itemId,
              labTechId: null,
              status: 'PENDING',
              paymentId: payment.id,
              ...(isPanel && { results: initialResults }),
            },
          });
          // 3. AssignedService
          const service = await tx.assignedService.create({
            data: {
              patientId,
              categoryName: body.categoryName.trim(),
              itemName: body.itemName.trim(),
              price: body.price,
              itemId: body.itemId,
              assignedById: session.user.id,
            },
            include: { assignedBy: { select: { name: true, role: true } } },
          });
          return service;
        });
        return NextResponse.json(result, { status: 201 });
      }
    }

    // Ambulator xizmat
    if (isAmbulatory) {
      // Agar bemor allaqachon aktiv ambulator admissiyaga ega bo'lsa — shu to'shakda qoladi
      const existingAdmission = await db.admission.findFirst({
        where: { patientId, admissionType: 'AMBULATORY', status: { in: ['PENDING', 'ACTIVE'] }, dischargeDate: null },
        include: { bed: { select: { id: true, bedNumber: true, room: { select: { roomNumber: true, floor: true } } } } },
      });

      if (existingAdmission) {
        // Yangi admission yaratmasdan, mavjud to'shakga yangi xizmat qo'shamiz
        const service = await db.assignedService.create({
          data: {
            patientId,
            categoryName: body.categoryName.trim(),
            itemName: body.itemName.trim(),
            price: body.price,
            itemId: body.itemId ?? null,
            assignedById: session.user.id,
            admissionId: existingAdmission.id,
            bedId: existingAdmission.bedId,
          },
          include: { assignedBy: { select: { name: true, role: true } } },
        });
        return NextResponse.json(service, { status: 201 });
      }

      // Yangi admission — bedId majburiy
      if (!body.bedId) {
        return NextResponse.json({ error: "To'shak tanlanmagan" }, { status: 400 });
      }

      const bed = await db.bed.findUnique({
        where: { id: body.bedId },
        include: { room: { select: { isAmbulatory: true, floor: true, roomNumber: true } } },
      });
      if (!bed) return NextResponse.json({ error: "To'shak topilmadi" }, { status: 404 });

      const result = await db.$transaction(async (tx: typeof db) => {
        // Admission PENDING holatida yaratamiz (QR scan kelganda ACTIVE bo'ladi)
        const admission = await tx.admission.create({
          data: {
            patientId,
            bedId: body.bedId,
            admissionType: 'AMBULATORY',
            dailyRate: body.price,
            status: 'PENDING',
          },
        });

        // AssignedService yaratish
        const service = await tx.assignedService.create({
          data: {
            patientId,
            categoryName: body.categoryName.trim(),
            itemName: body.itemName.trim(),
            price: body.price,
            itemId: body.itemId ?? null,
            assignedById: session.user.id,
            admissionId: admission.id,
            bedId: body.bedId,
          },
          include: { assignedBy: { select: { name: true, role: true } } },
        });

        return { service, admission };
      });

      return NextResponse.json(result.service, { status: 201 });
    }

    // Doktor tayinlangan bo'lsa — Appointment + Queue yaratamiz
    if (body.doctorId) {
      const result = await db.$transaction(async (tx: typeof db) => {
        // Bugun shu doktor uchun navbat raqami
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const lastQueue = await tx.queue.findFirst({
          where: {
            appointment: {
              doctorId: body.doctorId,
              dateTime: { gte: today, lt: tomorrow },
            },
          },
          orderBy: { queueNumber: 'desc' },
        });
        const queueNumber = (lastQueue?.queueNumber ?? 0) + 1;

        // Appointment yaratish
        const appt = await tx.appointment.create({
          data: {
            patientId,
            doctorId: body.doctorId,
            type: 'CHECKUP',
            dateTime: new Date(),
            status: 'IN_QUEUE',
          },
        });

        // Queue yaratish
        const queue = await tx.queue.create({
          data: {
            appointmentId: appt.id,
            queueNumber,
            status: 'WAITING',
            isUrgent: body.isUrgent ?? false,
          },
        });

        // AssignedService yaratish
        const service = await tx.assignedService.create({
          data: {
            patientId,
            categoryName: body.categoryName.trim(),
            itemName: body.itemName.trim(),
            price: body.price,
            itemId: body.itemId ?? null,
            assignedById: session.user.id,
            doctorId: body.doctorId,
            appointmentId: appt.id,
            isUrgent: body.isUrgent ?? false,
          },
          include: {
            assignedBy: { select: { name: true, role: true } },
          },
        });

        return { service, appointment: appt, queue };
      });

      return NextResponse.json(result.service, { status: 201 });
    }

    // Oddiy xizmat (doctorId yo'q)
    const service = await db.assignedService.create({
      data: {
        patientId,
        categoryName: body.categoryName.trim(),
        itemName: body.itemName.trim(),
        price: body.price,
        itemId: body.itemId ?? null,
        assignedById: session.user.id,
      },
      include: {
        assignedBy: { select: { name: true, role: true } },
      },
    });
    return NextResponse.json(service, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR']);
  if (!auth.ok) return auth.response;

  const { id: patientId } = await params;
  const { serviceId } = await req.json() as { serviceId: string };

  try {
    const svc = await db.assignedService.findFirst({ where: { id: serviceId, patientId } });
    if (!svc) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
    if (svc.isPaid) return NextResponse.json({ error: 'To\'langan xizmatni o\'chirib bo\'lmaydi' }, { status: 400 });

    await db.$transaction(async (tx: typeof db) => {
      // Agar appointment va queue bo'lsa — ularni ham o'chirish
      if (svc.appointmentId) {
        await tx.queue.deleteMany({ where: { appointmentId: svc.appointmentId } });
        await tx.appointment.delete({ where: { id: svc.appointmentId } }).catch(() => null);
      }

      // Agar lab xizmat bo'lsa — bog'liq LabTest va Payment ni ham o'chirish
      const catLower = (svc.categoryName ?? '').toLowerCase();
      const isLabService = catLower.includes('lab') || catLower.includes('laboratoriya') ||
        catLower.includes('labaratoriya') || catLower.includes('tahlil');

      if (isLabService && svc.itemId) {
        const labTest = await tx.labTest.findFirst({
          where: { patientId, testTypeId: svc.itemId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        });
        if (labTest) {
          await tx.labTest.delete({ where: { id: labTest.id } });
          if (labTest.paymentId) {
            await tx.payment.delete({ where: { id: labTest.paymentId } }).catch(() => null);
          }
        }
      }

      await tx.assignedService.delete({ where: { id: serviceId } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
