import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

const WRITE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.HEAD_NURSE];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Jadval topilmadi' }, { status: 404 });
    }

    return NextResponse.json(schedule);
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
  if (!WRITE_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Jadval topilmadi' }, { status: 404 });
    }

    const body = await req.json() as {
      startTime?: string;
      endTime?: string;
      notes?: string;
    };

    const { startTime, endTime } = body;

    // startTime va endTime validatsiya
    const newStart = startTime ?? existing.startTime;
    const newEnd = endTime ?? existing.endTime;

    if (newStart >= newEnd) {
      return NextResponse.json(
        { error: 'startTime endTime dan kichik bo\'lishi kerak' },
        { status: 400 }
      );
    }

    const updated = await prisma.schedule.update({
      where: { id },
      data: {
        startTime: newStart,
        endTime: newEnd,
        // notes Schedule modelida yo'q
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Jadval topilmadi' }, { status: 404 });
    }

    await prisma.schedule.delete({ where: { id } });

    return NextResponse.json({ message: 'Jadval o\'chirildi' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
