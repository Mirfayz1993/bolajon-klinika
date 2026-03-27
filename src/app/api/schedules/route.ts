import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

const WRITE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.HEAD_NURSE];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const dateParam = searchParams.get('date');
    const weekParam = searchParams.get('week');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (dateParam) {
      // date — ISO sana: shu kunning dayOfWeek ni topamiz
      const d = new Date(dateParam);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'date noto\'g\'ri format (ISO sana kerak)' }, { status: 400 });
      }
      where.dayOfWeek = d.getDay(); // 0=Yakshanba, 1=Dushanba, ...
    } else if (weekParam) {
      // week — ISO sana: shu haftaning barcha kunlari (0-6)
      const d = new Date(weekParam);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'week noto\'g\'ri format (ISO sana kerak)' }, { status: 400 });
      }
      // Haftaning barcha kunlari: 0..6
      where.dayOfWeek = { in: [0, 1, 2, 3, 4, 5, 6] };
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!WRITE_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      userId?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    };

    const { userId, date, startTime, endTime, notes } = body;

    if (!userId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'userId, date, startTime, endTime majburiy' },
        { status: 400 }
      );
    }

    // date validatsiya
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'date noto\'g\'ri format (ISO sana kerak)' }, { status: 400 });
    }

    // startTime < endTime tekshirish (HH:MM format)
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: 'startTime endTime dan kichik bo\'lishi kerak' },
        { status: 400 }
      );
    }

    // userId mavjudligini tekshirish
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 });
    }

    const dayOfWeek = d.getDay();

    // Bir xodim, bir kunda faqat 1 ta jadval (userId + dayOfWeek unikal)
    const existing = await prisma.schedule.findUnique({
      where: { userId_dayOfWeek: { userId, dayOfWeek } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Bu xodim uchun shu kunda jadval allaqachon mavjud' },
        { status: 409 }
      );
    }

    const schedule = await prisma.schedule.create({
      data: {
        userId,
        dayOfWeek,
        startTime,
        endTime,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // notes Schedule modelida yo'q, shuning uchun faqat mavjud maydonlar saqlanadi
    void notes; // notes schema da yo'q, ignore

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
