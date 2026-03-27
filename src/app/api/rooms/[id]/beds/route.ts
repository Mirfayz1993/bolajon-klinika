import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id: roomId } = await params;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }

    const body = await req.json() as {
      bedNumber?: string;
    };

    const { bedNumber } = body;

    if (!bedNumber) {
      return NextResponse.json({ error: 'bedNumber majburiy' }, { status: 400 });
    }

    const existing = await prisma.bed.findUnique({
      where: { roomId_bedNumber: { roomId, bedNumber } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Bu kravat raqami allaqachon mavjud' },
        { status: 400 }
      );
    }

    const bed = await prisma.bed.create({
      data: {
        roomId,
        bedNumber,
        status: 'AVAILABLE',
      },
    });

    return NextResponse.json(bed, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
