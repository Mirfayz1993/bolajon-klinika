import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
