import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: patientId } = await params;

  try {
    const services = await db.assignedService.findMany({
      where: { patientId },
      include: {
        assignedBy: { select: { name: true, role: true } },
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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ALLOWED = ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'];
  if (!ALLOWED.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: patientId } = await params;
  const body = await req.json() as {
    categoryName: string;
    itemName: string;
    price: number;
    itemId?: string;
  };

  if (!body.categoryName?.trim() || !body.itemName?.trim() || !body.price) {
    return NextResponse.json({ error: 'Maydonlar to\'ldirilmagan' }, { status: 400 });
  }

  try {
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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: patientId } = await params;
  const { serviceId } = await req.json() as { serviceId: string };

  try {
    const svc = await db.assignedService.findFirst({ where: { id: serviceId, patientId } });
    if (!svc) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
    if (svc.isPaid) return NextResponse.json({ error: 'To\'langan xizmatni o\'chirib bo\'lmaydi' }, { status: 400 });

    await db.assignedService.delete({ where: { id: serviceId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
