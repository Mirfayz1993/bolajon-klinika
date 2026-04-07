import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED = ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'];

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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

// POST /api/attendance  { userId, roomId? }  → check-in
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { userId: string; roomId?: string };
  if (!body.userId) return NextResponse.json({ error: 'userId majburiy' }, { status: 400 });

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
