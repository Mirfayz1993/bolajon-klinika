import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BedStatus } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const bed = await prisma.bed.findUnique({
      where: { id },
      include: {
        room: true,
      },
    });

    if (!bed) {
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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

    const existing = await prisma.bed.findUnique({ where: { id } });
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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const bed = await prisma.bed.findUnique({ where: { id } });
    if (!bed) {
      return NextResponse.json({ error: 'Kravat topilmadi' }, { status: 404 });
    }

    if (bed.status !== 'AVAILABLE') {
      return NextResponse.json(
        { error: 'Faqat bo\'sh (AVAILABLE) kravatni o\'chirish mumkin' },
        { status: 400 }
      );
    }

    await prisma.bed.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
