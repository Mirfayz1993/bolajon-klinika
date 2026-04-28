import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus, Prisma } from '@prisma/client';

// GET /api/rooms/[roomId]/beds?status=AVAILABLE
// Xonadagi to'shaklarni qaytaradi, ixtiyoriy status filtri bilan
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: roomId } = await params;
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status');

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const where: Record<string, unknown> = { roomId };
    if (statusParam) {
      where.status = statusParam;
    }
    // AVAILABLE so'rovida aktiv admissionli to'shaklarni ham chiqarib tashlash
    if (statusParam === 'AVAILABLE') {
      where.NOT = { admissions: { some: { dischargeDate: null } } };
    }

    const beds = await prisma.bed.findMany({
      where,
      include: {
        room: { select: { id: true, roomNumber: true, floor: true, isAmbulatory: true } },
      },
      orderBy: { bedNumber: 'asc' },
    });

    return NextResponse.json(beds);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/rooms/[roomId]/beds — xonaga yangi to'shak qo'shish
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: roomId } = await params;

  try {
    const body = await req.json() as { bedNumber?: string };
    const bedNumber = body.bedNumber?.trim();
    if (!bedNumber) return NextResponse.json({ error: 'bedNumber majburiy' }, { status: 400 });

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const existing = await prisma.bed.findUnique({
      where: { roomId_bedNumber: { roomId, bedNumber } },
    });
    if (existing) return NextResponse.json({ error: "Bu xonada bunday raqamli to'shak allaqachon mavjud" }, { status: 400 });

    const bed = await prisma.bed.create({
      data: { roomId, bedNumber, status: BedStatus.AVAILABLE },
      include: {
        room: { select: { id: true, roomNumber: true, floor: true, isAmbulatory: true } },
      },
    });

    return NextResponse.json(bed, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/rooms/[roomId]/beds?bedId=xxx — bo'sh to'shakni o'chirish
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: roomId } = await params;
  const { searchParams } = new URL(req.url);
  const bedId = searchParams.get('bedId');

  try {
    const bed = await prisma.bed.findFirst({
      where: bedId ? { id: bedId, roomId } : { roomId, status: BedStatus.AVAILABLE },
      include: { admissions: { where: { dischargeDate: null }, take: 1 } },
      orderBy: bedId ? undefined : { bedNumber: 'desc' },
    });

    if (!bed) return NextResponse.json({ error: "To'shak topilmadi" }, { status: 404 });
    if (bed.admissions.length > 0) {
      return NextResponse.json({ error: "Band to'shakni o'chirib bo'lmaydi" }, { status: 400 });
    }

    // Tarixiy admissionlarni tekshirish — FK constraint xatosini oldini olish uchun
    const totalAdmissions = await prisma.admission.count({ where: { bedId: bed.id } });
    if (totalAdmissions > 0) {
      return NextResponse.json(
        { error: "To'shakda tarixiy bemor yozuvlari bor — o'chirib bo'lmaydi. Status 'TA'MIRDA' qiling." },
        { status: 400 }
      );
    }

    // AssignedService.bedId soft-reference tekshiruvi (FK emas, lekin sanitar tekshirish)
    const totalAssignedServices = await prisma.assignedService.count({ where: { bedId: bed.id } });
    if (totalAssignedServices > 0) {
      return NextResponse.json(
        { error: "To'shakka bog'liq xizmat yozuvlari mavjud — o'chirib bo'lmaydi. Status 'TA'MIRDA' qiling." },
        { status: 400 }
      );
    }

    await prisma.bed.delete({ where: { id: bed.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Bed DELETE error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return NextResponse.json(
        { error: "To'shakka bog'liq yozuvlar mavjud, o'chirib bo'lmaydi" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
