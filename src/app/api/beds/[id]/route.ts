import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BedStatus } from '@prisma/client';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const bed = await prisma.bed.findFirst({
      where: { id, deletedAt: null },
      include: {
        room: true,
      },
    });

    if (!bed || bed.room.deletedAt) {
      return NextResponse.json({ error: 'To\'shak topilmadi' }, { status: 404 });
    }

    return NextResponse.json(bed);
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
      status?: string;
    };

    const { status } = body;

    if (!status || !Object.values(BedStatus).includes(status as BedStatus)) {
      return NextResponse.json(
        { error: 'status notogri. AVAILABLE, OCCUPIED yoki MAINTENANCE bo\'lishi kerak' },
        { status: 400 }
      );
    }

    const existing = await prisma.bed.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Kravat topilmadi' }, { status: 404 });
    }

    const bed = await prisma.bed.update({
      where: { id },
      data: { status: status as BedStatus },
    });

    return NextResponse.json(bed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/rooms:edit');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const bed = await prisma.bed.findFirst({ where: { id, deletedAt: null } });
    if (!bed) {
      return NextResponse.json({ error: 'Kravat topilmadi' }, { status: 404 });
    }

    if (bed.status !== 'AVAILABLE') {
      return NextResponse.json(
        { error: 'Faqat bo\'sh (AVAILABLE) kravatni o\'chirish mumkin' },
        { status: 400 }
      );
    }

    // Aktiv admission tekshirish — qo'shimcha sanitar tekshiruv
    const activeAdmissionsCount = await prisma.admission.count({
      where: { bedId: id, dischargeDate: null },
    });
    if (activeAdmissionsCount > 0) {
      return NextResponse.json(
        { error: "Kravatda aktiv bemor mavjud. Avval uni chiqaring." },
        { status: 400 }
      );
    }

    // Soft delete — tarixiy admission/payment yozuvlari saqlanadi
    await prisma.bed.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
