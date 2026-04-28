import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireAnyAction, requireSession } from '@/lib/api-auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
  // Eski xulq: ADMIN/HEAD_DOCTOR/HEAD_NURSE — endi action-level orqali.
  // /schedule:create (egasi yoki yarata oladigan) yoki /schedule:edit_others (boshqalarniki) — har biri yetadi.
  const auth = await requireAnyAction('/schedule:create', '/schedule:edit_others');
  if (!auth.ok) return auth.response;

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
  const auth = await requireAction('/schedule:delete');
  if (!auth.ok) return auth.response;

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
