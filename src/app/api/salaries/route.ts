import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSession, ROLE_GROUPS } from '@/lib/api-auth';

/**
 * month parametrini YYYY-MM formatda parse qilib { month, year } qaytaradi.
 * month: 1-12, year: to'liq yil.
 */
function parseYearMonth(yyyyMM: string): { month: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMM);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const monthParam = searchParams.get('month');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (monthParam) {
      const parsed = parseYearMonth(monthParam);
      if (!parsed) {
        return NextResponse.json(
          { error: 'month noto\'g\'ri format (YYYY-MM kerak)' },
          { status: 400 }
        );
      }
      where.month = parsed.month;
      where.year = parsed.year;
    }

    const [data, total] = await Promise.all([
      prisma.salary.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      }),
      prisma.salary.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ data, total, page, limit, totalPages });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Salaries uchun yangi action yo'q — ADMIN-only saqlangan
  const auth = await requireRole(ROLE_GROUPS.ADMIN_ONLY);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json() as {
      userId?: string;
      amount?: number;
      month?: string;
      notes?: string;
      bonuses?: number;
      deductions?: number;
    };

    const { userId, amount, month: monthParam, notes, bonuses, deductions } = body;

    if (!userId || amount === undefined || !monthParam) {
      return NextResponse.json(
        { error: 'userId, amount, month majburiy' },
        { status: 400 }
      );
    }

    // amount > 0 tekshirish
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'amount 0 dan katta bo\'lishi kerak' },
        { status: 400 }
      );
    }

    // month format YYYY-MM
    const parsed = parseYearMonth(monthParam);
    if (!parsed) {
      return NextResponse.json(
        { error: 'month noto\'g\'ri format (YYYY-MM kerak)' },
        { status: 400 }
      );
    }
    const { month, year } = parsed;

    // userId mavjudligini tekshirish
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 });
    }

    // Bir xodim, bir oyda faqat 1 ta maosh yozuvi (userId + month + year unikal)
    const existing = await prisma.salary.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Bu xodim uchun shu oyda maosh yozuvi allaqachon mavjud' },
        { status: 409 }
      );
    }

    // bonuses va deductions schema da yo'q, faqat amount saqlanadi
    // notes ham schema da yo'q — ignore
    void notes;
    void bonuses;
    void deductions;

    const salary = await prisma.salary.create({
      data: {
        userId,
        amount,
        month,
        year,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json(salary, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
