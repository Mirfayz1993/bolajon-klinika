import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

const WRITE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_NURSE];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const lowStock = searchParams.get('lowStock');
    const floorParam = searchParams.get('floor');
    const writtenOffParam = searchParams.get('writtenOff');
    const expiringSoon = searchParams.get('expiringSoon');

    // floor filter:
    // ?floor=null  → floor IS NULL (asosiy dorixona)
    // ?floor=2     → floor = 2
    // ?floor=3     → floor = 3
    // parametr yo'q → hammasi
    let floorWhere: { floor?: number | null } | undefined;
    if (floorParam !== null) {
      if (floorParam === 'null' || floorParam === '') {
        floorWhere = { floor: null };
      } else {
        const floorNum = parseInt(floorParam, 10);
        if (isNaN(floorNum)) {
          return NextResponse.json({ error: 'floor parametri noto\'g\'ri' }, { status: 400 });
        }
        floorWhere = { floor: floorNum };
      }
    }

    // writtenOff filter: default false (o'chirilmaganlar)
    const showWrittenOff =
      writtenOffParam === 'true' ? true :
      writtenOffParam === 'all'  ? undefined :
      false; // default: false

    // expiringSoon: 30 kun ichida muddati tugaydigan dorilar
    let expiryWhere: { expiryDate?: { lte: Date } } | undefined;
    if (expiringSoon === 'true') {
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      expiryWhere = { expiryDate: { lte: thirtyDaysLater } };
    }

    const searchWhere =
      search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { type: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : undefined;

    const medicines = await prisma.medicine.findMany({
      where: {
        ...(searchWhere ?? {}),
        ...(floorWhere ?? {}),
        ...(showWrittenOff !== undefined && { writtenOff: showWrittenOff }),
        ...(expiryWhere ?? {}),
      },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
        writtenOffBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // lowStock: Prisma column-to-column comparison qo'llab-quvvatlamaydi — post-fetch
    const result =
      lowStock === 'true'
        ? medicines.filter((m) => m.quantity < m.minStock)
        : medicines;

    return NextResponse.json(result);
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
      name?: string;
      unit?: string;
      type?: string;
      quantity?: number;
      minStock?: number;
      price?: number;
      supplierId?: string;
      expiryDate?: string;
      floor?: number | null;
    };

    const { name, quantity, minStock, price, supplierId, expiryDate } = body;
    // unit va type ikkalasini qabul qil — schemada "type" field bor
    const unitOrType = body.unit ?? body.type;

    if (
      !name ||
      unitOrType === undefined ||
      quantity === undefined ||
      minStock === undefined ||
      price === undefined ||
      !expiryDate
    ) {
      return NextResponse.json(
        { error: 'name, unit, quantity, minStock, price, expiryDate majburiy' },
        { status: 400 }
      );
    }

    if (quantity < 0) {
      return NextResponse.json({ error: 'quantity manfiy bo\'lishi mumkin emas' }, { status: 400 });
    }

    if (price < 0) {
      return NextResponse.json({ error: 'price manfiy bo\'lishi mumkin emas' }, { status: 400 });
    }

    const parsedExpiry = new Date(expiryDate);
    if (isNaN(parsedExpiry.getTime())) {
      return NextResponse.json({ error: 'expiryDate noto\'g\'ri format' }, { status: 400 });
    }

    // floor validatsiya: null, 2 yoki 3 bo'lishi kerak
    const floor = body.floor;
    if (floor !== undefined && floor !== null && floor !== 2 && floor !== 3) {
      return NextResponse.json(
        { error: 'floor faqat null, 2 yoki 3 bo\'lishi mumkin' },
        { status: 400 }
      );
    }

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        return NextResponse.json({ error: 'Yetkazib beruvchi topilmadi' }, { status: 404 });
      }
    }

    const medicine = await prisma.medicine.create({
      data: {
        name,
        type: unitOrType,
        quantity,
        minStock,
        price,
        expiryDate: parsedExpiry,
        supplierId: supplierId ?? undefined,
        floor: floor !== undefined ? floor : null,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        writtenOffBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(medicine, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
