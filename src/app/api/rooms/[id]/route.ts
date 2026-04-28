import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
      isAmbulatory?: boolean;
    };

    const { floor, roomNumber, type, capacity, isActive, isAmbulatory } = body;

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

    const bedIds = room.beds.map((b) => b.id);

    // Barcha bog'liq yozuvlar sonini parallel hisoblash
    const [
      appointmentsCount,
      inventoryCount,
      expensesCount,
      attendancesCount,
      generalExpensesCount,
      responsibleCount,
      historicalAdmissionsCount,
    ] = await Promise.all([
      prisma.appointment.count({ where: { roomId: id } }),
      prisma.roomInventoryItem.count({ where: { roomId: id } }),
      prisma.roomExpense.count({ where: { roomId: id } }),
      prisma.attendance.count({ where: { roomId: id } }),
      prisma.generalExpense.count({ where: { roomId: id } }),
      prisma.roomResponsible.count({ where: { roomId: id } }),
      bedIds.length > 0
        ? prisma.admission.count({ where: { bedId: { in: bedIds } } })
        : Promise.resolve(0),
    ]);

    // Bloklovchi yozuvlar ro'yxatini yig'ish (responsible blok qilmaydi — transaction'da o'chiriladi)
    const blockers: string[] = [];
    if (appointmentsCount > 0) blockers.push(`${appointmentsCount} ta uchrashuv`);
    if (historicalAdmissionsCount > 0) blockers.push(`${historicalAdmissionsCount} ta tarixiy bemor yozuvi`);
    if (inventoryCount > 0) blockers.push(`${inventoryCount} ta inventar yozuv`);
    if (expensesCount > 0) blockers.push(`${expensesCount} ta xarajat yozuvi`);
    if (attendancesCount > 0) blockers.push(`${attendancesCount} ta davomat yozuvi`);
    if (generalExpensesCount > 0) blockers.push(`${generalExpensesCount} ta umumiy xarajat yozuvi`);

    if (blockers.length > 0) {
      return NextResponse.json(
        { error: `Xonani o'chirib bo'lmaydi: ${blockers.join(', ')} mavjud.` },
        { status: 400 }
      );
    }

    // Bog'liqliklar yo'q — transaction ichida tartib bilan o'chirish
    await prisma.$transaction(async (tx) => {
      if (responsibleCount > 0) {
        await tx.roomResponsible.deleteMany({ where: { roomId: id } });
      }
      // RoomInventoryLog (inventoryCount=0 bo'lsa ham log qolgan bo'lishi mumkin)
      await tx.roomInventoryLog.deleteMany({ where: { roomId: id } });
      // Bedlar (admissions/payments tekshirilgan, allaqachon yo'q)
      await tx.bed.deleteMany({ where: { roomId: id } });
      await tx.room.delete({ where: { id } });
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
