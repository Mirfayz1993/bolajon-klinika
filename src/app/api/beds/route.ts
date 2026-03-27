import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    const statusParam = searchParams.get('status');

    const where: {
      roomId?: string;
      status?: BedStatus;
    } = {};

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

    const beds = await prisma.bed.findMany({
      where,
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
      orderBy: [{ room: { floor: 'asc' } }, { bedNumber: 'asc' }],
    });

    return NextResponse.json(beds);
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

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }

    const existing = await prisma.bed.findUnique({
      where: { roomId_bedNumber: { roomId, bedNumber: number } },
    });
    if (existing) {
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
