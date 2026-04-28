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
  const isAdmin = session.user.role === 'ADMIN';
  const includeDeleted = isAdmin && searchParams.get('includeDeleted') === 'true';
  const onlyDeleted = isAdmin && searchParams.get('onlyDeleted') === 'true';

  try {
    const room = await prisma.room.findFirst({
      where: includeDeleted || onlyDeleted ? { id: roomId } : { id: roomId, deletedAt: null },
    });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const where: Record<string, unknown> = { roomId };
    if (onlyDeleted) {
      where.deletedAt = { not: null };
    } else if (!includeDeleted) {
      where.deletedAt = null;
    }
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

    const room = await prisma.room.findFirst({ where: { id: roomId, deletedAt: null } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const existing = await prisma.bed.findUnique({
      where: { roomId_bedNumber: { roomId, bedNumber } },
    });
    if (existing) {
      if (existing.deletedAt) {
        return NextResponse.json(
          { error: "Bu raqamli to'shak avval o'chirilgan. Iltimos, to'shakni tiklang yoki boshqa raqam tanlang." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Bu xonada bunday raqamli to'shak allaqachon mavjud" }, { status: 400 });
    }

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
      where: bedId
        ? { id: bedId, roomId, deletedAt: null }
        : { roomId, status: BedStatus.AVAILABLE, deletedAt: null },
      include: { admissions: { where: { dischargeDate: null }, take: 1 } },
      orderBy: bedId ? undefined : { bedNumber: 'desc' },
    });

    if (!bed) return NextResponse.json({ error: "To'shak topilmadi" }, { status: 404 });
    if (bed.admissions.length > 0) {
      return NextResponse.json({ error: "Band to'shakni o'chirib bo'lmaydi" }, { status: 400 });
    }

    // Soft delete — tarixiy admission/assignedService yozuvlari saqlanadi (audit uchun)
    await prisma.bed.update({
      where: { id: bed.id },
      data: { deletedAt: new Date() },
    });
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
