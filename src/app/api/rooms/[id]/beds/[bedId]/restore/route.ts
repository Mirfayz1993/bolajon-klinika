import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';

// POST /api/rooms/[id]/beds/[bedId]/restore
// Soft-deleted to'shakni tiklash. Xona aktiv (deletedAt=null) bo'lishi shart —
// agar xona o'chirilgan bo'lsa, avval xona tiklanishi kerak.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; bedId: string }> }
) {
  const auth = await requireAction('/rooms:edit');
  if (!auth.ok) return auth.response;

  try {
    const { id: roomId, bedId } = await params;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }
    if (room.deletedAt) {
      return NextResponse.json(
        { error: "Xona o'chirilgan. Avval xonani tiklang." },
        { status: 400 }
      );
    }

    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed || bed.roomId !== roomId) {
      return NextResponse.json({ error: "To'shak topilmadi" }, { status: 404 });
    }
    if (!bed.deletedAt) {
      return NextResponse.json(
        { error: "To'shak o'chirilmagan, tiklab bo'lmaydi" },
        { status: 400 }
      );
    }

    // Bir xil roomId+bedNumber bilan aktiv to'shak bormi?
    const conflict = await prisma.bed.findFirst({
      where: {
        roomId,
        bedNumber: bed.bedNumber,
        deletedAt: null,
        id: { not: bedId },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Bu raqamli to'shak allaqachon faol. Tiklab bo'lmaydi." },
        { status: 400 }
      );
    }

    const restored = await prisma.bed.update({
      where: { id: bedId },
      data: { deletedAt: null },
      include: {
        room: { select: { id: true, roomNumber: true, floor: true, isAmbulatory: true } },
      },
    });

    return NextResponse.json(restored);
  } catch (error) {
    console.error('Bed restore error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
