import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const floorParam = searchParams.get('floor');
    const typeParam = searchParams.get('type');
    const statusParam = searchParams.get('status');
    const isActiveParam = searchParams.get('isActive');

    const isAmbulatoryParam = searchParams.get('isAmbulatory');

    const where: {
      floor?: number;
      type?: string;
      isActive?: boolean;
      isAmbulatory?: boolean;
    } = {};

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
          select: {
            id: true,
            bedNumber: true,
            status: true,
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
          select: { beds: true },
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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

    const existing = await prisma.room.findUnique({
      where: { floor_roomNumber: { floor, roomNumber } },
    });
    if (existing) {
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
