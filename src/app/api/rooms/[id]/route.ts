import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        beds: true,
        _count: {
          select: { appointments: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const body = await req.json() as {
      floor?: number;
      roomNumber?: string;
      type?: string;
      capacity?: number;
      isActive?: boolean;
    };

    const { floor, roomNumber, type, capacity, isActive } = body;

    const existing = await prisma.room.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }

    if (floor !== undefined && (floor < 1 || floor > 4)) {
      return NextResponse.json(
        { error: 'floor 1 dan 4 gacha bo\'lishi kerak' },
        { status: 400 }
      );
    }

    const newFloor = floor ?? existing.floor;
    const newRoomNumber = roomNumber ?? existing.roomNumber;

    if (floor !== undefined || roomNumber !== undefined) {
      const duplicate = await prisma.room.findUnique({
        where: { floor_roomNumber: { floor: newFloor, roomNumber: newRoomNumber } },
      });
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: 'Bu qavat va xona raqami allaqachon mavjud' },
          { status: 400 }
        );
      }
    }

    const room = await prisma.room.update({
      where: { id },
      data: {
        floor: floor ?? undefined,
        roomNumber: roomNumber ?? undefined,
        type: type ?? undefined,
        capacity: capacity ?? undefined,
        isActive: isActive ?? undefined,
      },
      include: {
        beds: true,
        _count: { select: { appointments: true } },
      },
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: { beds: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }

    const hasOccupied = room.beds.some((bed) => bed.status !== 'AVAILABLE');
    if (hasOccupied) {
      return NextResponse.json(
        { error: 'Xonada band yoki ta\'mirdagi kravatlar mavjud. Avval ularni bo\'shating.' },
        { status: 400 }
      );
    }

    // Delete all beds first, then the room
    await prisma.bed.deleteMany({ where: { roomId: id } });
    await prisma.room.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
