import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { z } from 'zod';

const checkInSchema = z.object({
  userId: z.string().min(1),
  roomId: z.string().min(1).optional(),
});

function dayStart(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}
function dayEnd(d: Date) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

// GET /api/attendance?date=2026-04-07
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const dateParam = new URL(req.url).searchParams.get('date');
  const day = dateParam ? new Date(dateParam) : new Date();

  const records = await prisma.attendance.findMany({
    where: { date: { gte: dayStart(day), lte: dayEnd(day) } },
    include: {
      user: { select: { id: true, name: true, role: true, specializationId: true } },
      room: { select: { id: true, floor: true, roomNumber: true, type: true } },
    },
    orderBy: { checkIn: 'desc' },
  });

  // Active staff (not deleted)
  const staff = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ records, staff });
}

// POST /api/attendance  { userId, roomId? }  → check-in (page-level — har xodim attendance ko'rsatadi)
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const parsed = await validateBody(req, checkInSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const today = new Date();

  // Allaqachon bugun check-in qilinganmi?
  const existing = await prisma.attendance.findFirst({
    where: { userId: body.userId, date: { gte: dayStart(today), lte: dayEnd(today) } },
  });
  if (existing) {
    return NextResponse.json({ error: 'Bugun allaqachon belgilangan' }, { status: 400 });
  }

  const record = await prisma.attendance.create({
    data: {
      userId: body.userId,
      roomId: body.roomId ?? null,
      checkIn: today,
      date: dayStart(today),
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
      room: { select: { id: true, floor: true, roomNumber: true, type: true } },
    },
  });

  return NextResponse.json(record, { status: 201 });
}
