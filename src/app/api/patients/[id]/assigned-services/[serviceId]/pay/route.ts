import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

async function sendLabNotification(patientId: string, testName: string, token: string, chatId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true },
  });
  if (!patient) return;

  const text = `🔬 Yangi tahlil buyurtmasi!\n\nBemor: ${patient.lastName} ${patient.firstName}\nTahlil: ${testName}\n\nTo'lov qabul qilindi ✅`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ALLOWED = ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'];
  if (!ALLOWED.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: patientId, serviceId } = await params;
  const body = await req.json() as { method: string };

  const method = body.method ?? 'CASH';
  const VALID_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CLICK', 'PAYME'];
  if (!VALID_METHODS.includes(method)) {
    return NextResponse.json({ error: "Notogri tolov usuli" }, { status: 400 });
  }

  try {
    const svc = await db.assignedService.findFirst({ where: { id: serviceId, patientId } });
    if (!svc) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
    if (svc.isPaid) return NextResponse.json({ error: "Allaqachon tolangan" }, { status: 400 });

    const catMap: Record<string, string> = {
      laboratoriya: 'LAB_TEST',
      labaratoriya: 'LAB_TEST',
      tahlil: 'LAB_TEST',
      massaj: 'MASSAGE',
      logoped: 'SPEECH_THERAPY',
      statsionar: 'INPATIENT',
      ambulator: 'AMBULATORY',
      korik: 'CHECKUP',
      shifokor: 'CHECKUP',
    };

    const catLower = svc.categoryName.toLowerCase();
    let category = 'CHECKUP';
    for (const [key, val] of Object.entries(catMap)) {
      if (catLower.includes(key)) { category = val; break; }
    }

    let notifyLabTestId: string | null = null;

    const payment = await db.$transaction(async (tx: typeof db) => {
      const pay = await tx.payment.create({
        data: {
          patientId,
          amount: Number(svc.price),
          method,
          category,
          status: 'PAID',
          description: `${svc.categoryName} - ${svc.itemName}`,
          receivedById: session.user.id,
        },
      });
      await tx.assignedService.update({
        where: { id: serviceId },
        data: { isPaid: true, paidAt: new Date(), paymentId: pay.id },
      });
      // Lab xizmati to'landi → mavjud LabTest ni PAID payment bilan yangilaymiz
      if (category === 'LAB_TEST' && svc.itemId) {
        // Eng oxirgi to'lanmagan LabTest ni topib paymentId ni yangilaymiz
        const existing = await tx.labTest.findFirst({
          where: { patientId, testTypeId: svc.itemId },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) {
          // Eski paymentId ni bo'shatamiz (unique constraint uchun), keyin yangi PAID ni biriktiramiz
          if (existing.paymentId && existing.paymentId !== pay.id) {
            const oldPaymentId = existing.paymentId;
            await tx.labTest.update({ where: { id: existing.id }, data: { paymentId: null } });
            await tx.payment.delete({ where: { id: oldPaymentId } });
          }
          await tx.labTest.update({
            where: { id: existing.id },
            data: { paymentId: pay.id },
          });
          notifyLabTestId = existing.id;
        } else {
          // Fallback: yangi LabTest yaratamiz
          const lt = await tx.labTest.create({
            data: { patientId, testTypeId: svc.itemId, labTechId: null, status: 'PENDING', paymentId: pay.id },
          });
          notifyLabTestId = lt.id;
        }
      }
      return pay;
    });

    // Audit log
    writeAuditLog({
      userId: session.user.id,
      action: 'PAYMENT',
      module: 'assigned-services',
      details: {
        serviceId,
        patientId,
        amount: Number(svc.price),
        item: `${svc.categoryName} - ${svc.itemName}`,
        method,
        paymentId: payment.id,
      },
    }).catch(() => {});

    // Laborantlarga Telegram xabar (fire & forget)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_LAB_CHAT_ID;
    if (notifyLabTestId && token && chatId) {
      sendLabNotification(patientId, svc.itemName, token, chatId).catch(() => {});
    }

    return NextResponse.json({ ok: true, paymentId: payment.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
