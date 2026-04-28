import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeDeleted = session.user.role === 'ADMIN' && searchParams.get('includeDeleted') === 'true';

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        beds: {
          where: includeDeleted ? undefined : { deletedAt: null },
        },
        _count: {
          select: { appointments: true },
        },
      },
    });

    if (!room || (!includeDeleted && room.deletedAt)) {
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
  const auth = await requireAction('/rooms:edit');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const body = await req.json() as {
      floor?: number;
      roomNumber?: string;
      type?: string;
      capacity?: number;
      isActive?: boolean;
      isAmbulatory?: boolean;
    };

    const { floor, roomNumber, type, capacity, isActive, isAmbulatory } = body;

    const existing = await prisma.room.findFirst({ where: { id, deletedAt: null } });
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
      const duplicate = await prisma.room.findFirst({
        where: {
          floor: newFloor,
          roomNumber: newRoomNumber,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Bu qavat va xona raqami allaqachon mavjud' },
          { status: 400 }
        );
      }
    }

    // floor o'zgarsa isAmbulatory avtomatik qayta hisoblanadi
    const effectiveFloor = floor ?? existing.floor;
    const computedIsAmbulatory = floor !== undefined ? effectiveFloor === 3 : (isAmbulatory ?? undefined);

    const room = await prisma.room.update({
      where: { id },
      data: {
        floor: floor ?? undefined,
        roomNumber: roomNumber ?? undefined,
        type: type ?? undefined,
        capacity: capacity ?? undefined,
        isActive: isActive ?? undefined,
        isAmbulatory: computedIsAmbulatory,
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
  const auth = await requireAction('/rooms:delete');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const room = await prisma.room.findFirst({
      where: { id, deletedAt: null },
    });

    if (!room) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }

    // Soft delete — faqat aktiv (chiqarilmagan) admission borligini tekshirish.
    // Tarixiy admissions, payments, expenses saqlanadi (audit uchun) — soft delete
    // ularga ta'sir qilmaydi.
    const activeAdmissionsCount = await prisma.admission.count({
      where: { bed: { roomId: id }, dischargeDate: null },
    });

    if (activeAdmissionsCount > 0) {
      return NextResponse.json(
        { error: 'Xonada hozir bemor yotibdi. Avval bemorni chiqarib oling.' },
        { status: 400 }
      );
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.bed.updateMany({
        where: { roomId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.room.update({
        where: { id },
        data: { deletedAt: now },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room DELETE error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json(
        { error: "Xonaga bog'liq yozuvlar mavjud, o'chirib bo'lmaydi" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
