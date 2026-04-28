import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const floorParam = searchParams.get('floor');
    const typeParam = searchParams.get('type');
    const statusParam = searchParams.get('status');
    const isActiveParam = searchParams.get('isActive');

    const isAmbulatoryParam = searchParams.get('isAmbulatory');
    const includeDeletedParam = searchParams.get('includeDeleted');
    const onlyDeletedParam = searchParams.get('onlyDeleted');

    // ADMIN faqat o'chirilgan yozuvlarni ko'ra oladi
    const isAdmin = session.user.role === 'ADMIN';
    const includeDeleted = isAdmin && includeDeletedParam === 'true';
    const onlyDeleted = isAdmin && onlyDeletedParam === 'true';

    const where: {
      floor?: number;
      type?: string;
      isActive?: boolean;
      isAmbulatory?: boolean;
      deletedAt?: Date | null | { not: null };
    } = {};

    if (onlyDeleted) {
      where.deletedAt = { not: null };
    } else if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (floorParam) {
      const floor = parseInt(floorParam, 10);
      if (!isNaN(floor) && floor >= 1 && floor <= 4) where.floor = floor;
    }

    if (typeParam) {
      where.type = typeParam;
    }

    // status param: 'active' => isActive true, 'inactive' => isActive false
    if (statusParam !== null) {
      where.isActive = statusParam !== 'inactive';
    } else if (isActiveParam !== null) {
      where.isActive = isActiveParam !== 'false';
    }

    if (isAmbulatoryParam !== null) {
      where.isAmbulatory = isAmbulatoryParam !== 'false';
    }

    const rooms = await prisma.room.findMany({
      where,
      include: {
        beds: {
          where: includeDeleted || onlyDeleted ? undefined : { deletedAt: null },
          select: {
            id: true,
            bedNumber: true,
            status: true,
            deletedAt: true,
            admissions: {
              where: { dischargeDate: null },
              select: {
                id: true,
                patient: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
              take: 1,
            },
          },
        },
        _count: {
          select: { beds: { where: { deletedAt: null } } },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/rooms:create');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json() as {
      floor?: number;
      roomNumber?: string;
      type?: string;
      capacity?: number;
      isActive?: boolean;
    };

    const { floor, roomNumber, type, capacity, isActive } = body;

    if (!floor || !roomNumber || !type) {
      return NextResponse.json(
        { error: 'floor, roomNumber, type majburiy' },
        { status: 400 }
      );
    }

    if (floor < 1 || floor > 4) {
      return NextResponse.json(
        { error: 'floor 1 dan 4 gacha bo\'lishi kerak' },
        { status: 400 }
      );
    }

    // Faqat aktiv (deletedAt=null) xonalarni duplicate sifatida hisoblash —
    // soft-deleted xona qoldirgan kombinatsiya yangi xona uchun ochiq bo'lishi kerak.
    // Lekin DB darajasidagi @@unique([floor, roomNumber]) FK bilan to'qnash kelmaslik
    // uchun: agar shu kombinatsiyada deleted yozuv bor bo'lsa — restore qilishni taklif et.
    const existing = await prisma.room.findUnique({
      where: { floor_roomNumber: { floor, roomNumber } },
    });
    if (existing) {
      if (existing.deletedAt) {
        return NextResponse.json(
          { error: 'Bu qavat va xona raqami avval o\'chirilgan. Iltimos, xonani tiklang yoki boshqa raqam tanlang.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Bu qavat va xona raqami allaqachon mavjud' },
        { status: 400 }
      );
    }

    const isAmbulatory = floor === 3; // 3-qavat = ambulator bo'lim

    const room = await prisma.room.create({
      data: {
        floor,
        roomNumber,
        type,
        capacity: capacity ?? 1,
        isActive: isActive ?? true,
        isAmbulatory,
      },
      include: {
        beds: {
          select: { id: true, bedNumber: true, status: true },
        },
        _count: { select: { beds: true } },
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
