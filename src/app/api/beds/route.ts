import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BedStatus } from '@prisma/client';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    const statusParam = searchParams.get('status');

    const ambulatoryParam = searchParams.get('ambulatory');

    const floorParam = searchParams.get('floor');

    const isAdmin = session.user.role === 'ADMIN';
    const includeDeleted = isAdmin && searchParams.get('includeDeleted') === 'true';
    const onlyDeleted = isAdmin && searchParams.get('onlyDeleted') === 'true';

    const where: {
      roomId?: string;
      status?: BedStatus;
      deletedAt?: Date | null | { not: null };
      room?: { isAmbulatory?: boolean; floor?: number; deletedAt?: Date | null };
    } = {};

    if (onlyDeleted) {
      where.deletedAt = { not: null };
    } else if (!includeDeleted) {
      where.deletedAt = null;
      where.room = { deletedAt: null };
    }

    if (roomId) where.roomId = roomId;

    if (statusParam) {
      if (!Object.values(BedStatus).includes(statusParam as BedStatus)) {
        return NextResponse.json(
          { error: 'status noto\'g\'ri. AVAILABLE, OCCUPIED yoki MAINTENANCE bo\'lishi kerak' },
          { status: 400 }
        );
      }
      where.status = statusParam as BedStatus;
    }

    if (ambulatoryParam === 'true') {
      where.room = { ...where.room, isAmbulatory: true };
    } else if (ambulatoryParam === 'false') {
      where.room = { ...where.room, isAmbulatory: false };
    }

    if (floorParam) {
      const floorNum = parseInt(floorParam, 10);
      if (!isNaN(floorNum)) {
        where.room = { ...where.room, floor: floorNum };
      }
    }

    // status=AVAILABLE so'rovida aktiv admissionli to'shaklarni ham chiqarib tashlash
    const whereWithAdmission: typeof where & {
      NOT?: { admissions: { some: { dischargeDate: null } } };
    } = { ...where };
    if (statusParam === 'AVAILABLE') {
      whereWithAdmission.NOT = { admissions: { some: { dischargeDate: null } } };
    }

    const beds = await prisma.bed.findMany({
      where: whereWithAdmission,
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            floor: true,
            type: true,
            isAmbulatory: true,
          },
        },
      },
      orderBy: [{ room: { floor: 'asc' } }, { bedNumber: 'asc' }],
    });

    return NextResponse.json(beds);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/rooms:edit');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json() as {
      roomId?: string;
      number?: string;
    };

    const { roomId, number } = body;

    if (!roomId || !number) {
      return NextResponse.json(
        { error: 'roomId va number majburiy' },
        { status: 400 }
      );
    }

    const room = await prisma.room.findFirst({ where: { id: roomId, deletedAt: null } });
    if (!room) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }

    const existing = await prisma.bed.findUnique({
      where: { roomId_bedNumber: { roomId, bedNumber: number } },
    });
    if (existing) {
      if (existing.deletedAt) {
        return NextResponse.json(
          { error: "Bu raqamli to'shak avval o'chirilgan. Iltimos, to'shakni tiklang yoki boshqa raqam tanlang." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Bu xonada bunday raqamli to\'shak allaqachon mavjud' },
        { status: 400 }
      );
    }

    const bed = await prisma.bed.create({
      data: {
        roomId,
        bedNumber: number,
        status: BedStatus.AVAILABLE,
      },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            floor: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json(bed, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
