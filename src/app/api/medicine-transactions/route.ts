import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role, MedicineTransactionType } from '@prisma/client';

const WRITE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_NURSE, Role.NURSE];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const medicineId = searchParams.get('medicineId');
    const typeParam = searchParams.get('type'); // IN | OUT
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    // Map IN/OUT -> STOCK_IN/STOCK_OUT
    let transactionType: MedicineTransactionType | undefined;
    if (typeParam === 'IN') transactionType = MedicineTransactionType.STOCK_IN;
    else if (typeParam === 'OUT') transactionType = MedicineTransactionType.STOCK_OUT;

    const where: Record<string, unknown> = {};
    if (medicineId) where.medicineId = medicineId;
    if (transactionType) where.type = transactionType;

    const [data, total] = await Promise.all([
      prisma.medicineTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          medicine: {
            select: { id: true, name: true, type: true },
          },
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.medicineTransaction.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ data, total, page, limit, totalPages });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!WRITE_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      medicineId?: string;
      type?: string; // 'IN' | 'OUT'
      quantity?: number;
      patientId?: string;
      notes?: string;
      supplierId?: string;
      expiryDate?: string;
      floor?: number | null;
    };

    const { medicineId, type, quantity, patientId, notes, supplierId, expiryDate, floor } = body;

    if (!medicineId || !type || quantity === undefined) {
      return NextResponse.json(
        { error: 'medicineId, type, quantity majburiy' },
        { status: 400 }
      );
    }

    if (type !== 'IN' && type !== 'OUT') {
      return NextResponse.json({ error: 'type faqat IN yoki OUT bo\'lishi mumkin' }, { status: 400 });
    }

    if (type === 'OUT' && !patientId) {
      return NextResponse.json({ error: 'STOCK_OUT uchun patientId majburiy' }, { status: 400 });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'quantity musbat butun son bo\'lishi kerak' }, { status: 400 });
    }

    const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
    if (!medicine) {
      return NextResponse.json({ error: 'Dori topilmadi' }, { status: 404 });
    }

    if (type === 'OUT' && medicine.quantity < quantity) {
      return NextResponse.json(
        {
          error: `Yetarli zaxira yo\'q. Mavjud: ${medicine.quantity}, so\'ralgan: ${quantity}`,
        },
        { status: 400 }
      );
    }

    if (patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) {
        return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
      }
    }

    if (type === 'OUT') {
      // Atomik 3 ta amal: MedicineTransaction + Medicine.quantity kamaytirish + Payment
      const result = await prisma.$transaction(async (tx) => {
        // Race condition oldini olish: quantity ni tx ichida qayta tekshirish
        const currentMedicine = await tx.medicine.findUnique({ where: { id: medicineId } });
        if (!currentMedicine || currentMedicine.quantity < quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${currentMedicine?.quantity ?? 0}`);
        }

        // 1. MedicineTransaction yaratish
        const transaction = await tx.medicineTransaction.create({
          data: {
            medicineId,
            type: MedicineTransactionType.STOCK_OUT,
            quantity,
            patientId: patientId ?? undefined,
            notes: notes ?? undefined,
          },
          include: {
            medicine: { select: { id: true, name: true, type: true } },
            patient: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        // 2. Medicine.quantity kamaytirish
        await tx.medicine.update({
          where: { id: medicineId },
          data: { quantity: { decrement: quantity } },
        });

        // 3. AssignedService yaratish — bemor profilining Xizmatlar tabida ko'rinadi
        const assignedService = await tx.assignedService.create({
          data: {
            patientId: patientId!,
            categoryName: 'Dori',
            itemName: `${medicine.name} x${quantity}`,
            price: Number(medicine.price) * quantity,
            isPaid: false,
            assignedById: session.user.id,
          },
        });

        return { transaction, assignedService };
      });

      return NextResponse.json(result, { status: 201 });
    } else {
      // STOCK_IN — transaction + quantity oshirish + expiryDate/supplierId yangilash
      let parsedExpiry: Date | undefined;
      if (expiryDate) {
        parsedExpiry = new Date(expiryDate);
        if (isNaN(parsedExpiry.getTime())) {
          return NextResponse.json({ error: 'expiryDate noto\'g\'ri format' }, { status: 400 });
        }
      }

      if (supplierId) {
        const sup = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (!sup) return NextResponse.json({ error: 'Yetkazib beruvchi topilmadi' }, { status: 404 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.medicineTransaction.create({
          data: {
            medicineId,
            type: MedicineTransactionType.STOCK_IN,
            quantity,
            notes: notes ?? undefined,
          },
          include: {
            medicine: { select: { id: true, name: true, type: true } },
          },
        });

        await tx.medicine.update({
          where: { id: medicineId },
          data: {
            quantity: { increment: quantity },
            ...(parsedExpiry && { expiryDate: parsedExpiry }),
            ...(supplierId && { supplierId }),
            ...(floor !== undefined && { floor: floor }),
          },
        });

        return { transaction };
      });

      return NextResponse.json(result, { status: 201 });
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      const available = error.message.split(':')[1];
      return NextResponse.json(
        { error: `Yetarli zaxira yo'q. Mavjud: ${available}` },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
