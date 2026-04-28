import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const roomTypes = await prisma.roomType.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(roomTypes);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/settings:manage_room_types');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json() as { name?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: 'name majburiy' }, { status: 400 });

    const existing = await prisma.roomType.findUnique({ where: { name } });
    if (existing) return NextResponse.json({ error: 'Bu nomli xona turi allaqachon mavjud' }, { status: 400 });

    const roomType = await prisma.roomType.create({ data: { name } });
    return NextResponse.json(roomType, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
