import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const specializations = await prisma.specialization.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(specializations);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/settings:manage_specs');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json() as { name?: string };
    const { name } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'name majburiy' }, { status: 400 });
    }

    const existing = await prisma.specialization.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Bu nomli mutaxassislik allaqachon mavjud' }, { status: 400 });
    }

    const specialization = await prisma.specialization.create({
      data: { name: name.trim() },
    });

    return NextResponse.json(specialization, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
