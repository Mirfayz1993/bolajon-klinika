import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
