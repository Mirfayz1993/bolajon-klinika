import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';

// POST /api/rooms/[id]/restore
// Soft-deleted xonani tiklash. /rooms:edit action ruxsati bilan ochiladi.
// Bedlar avtomatik tiklanmaydi — ular alohida endpoint orqali tiklanadi.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/rooms:edit');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });
    }
    if (!room.deletedAt) {
      return NextResponse.json(
        { error: "Xona o'chirilmagan, tiklab bo'lmaydi" },
        { status: 400 }
      );
    }

    // Bir xil floor+roomNumber kombinatsiyasi bo'yicha aktiv (deletedAt=null) xona bormi?
    // (xona o'chirilgan vaqtda boshqasi yaratilgan bo'lishi mumkin)
    const conflict = await prisma.room.findFirst({
      where: {
        floor: room.floor,
        roomNumber: room.roomNumber,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Bu qavat va xona raqami allaqachon faol xona tomonidan band. Tiklab bo'lmaydi." },
        { status: 400 }
      );
    }

    const restored = await prisma.room.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        beds: { where: { deletedAt: null } },
        _count: { select: { beds: { where: { deletedAt: null } } } },
      },
    });

    return NextResponse.json(restored);
  } catch (error) {
    console.error('Room restore error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
