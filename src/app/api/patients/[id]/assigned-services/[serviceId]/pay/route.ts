import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

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
      return pay;
    });

    return NextResponse.json({ ok: true, paymentId: payment.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
