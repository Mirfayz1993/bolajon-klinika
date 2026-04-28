import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const room = await prisma.room.findFirst({ where: { id, deletedAt: null } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const responsible = await prisma.roomResponsible.findUnique({
      where: { roomId: id },
      include: {
        user: { select: { id: true, name: true, role: true, phone: true } },
        assignedBy: { select: { name: true } },
      },
    });
    return NextResponse.json({ responsible });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireAction('/rooms:assign_responsible');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = await req.json() as { userId?: string };
    if (!body.userId) return NextResponse.json({ error: 'userId majburiy' }, { status: 400 });

    const room = await prisma.room.findFirst({ where: { id, deletedAt: null } });
    if (!room) return NextResponse.json({ error: 'Xona topilmadi' }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) return NextResponse.json({ error: 'Xodim topilmadi' }, { status: 404 });

    const responsible = await prisma.roomResponsible.upsert({
      where: { roomId: id },
      create: {
        roomId: id,
        userId: body.userId,
        assignedById: session.user.id,
      },
      update: {
        userId: body.userId,
        assignedById: session.user.id,
        assignedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, role: true, phone: true } },
        assignedBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ responsible });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
