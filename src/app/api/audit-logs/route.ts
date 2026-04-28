import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, ROLE_GROUPS } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(ROLE_GROUPS.ADMIN_ONLY);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);

    const userId  = searchParams.get('userId')  || undefined;
    const action  = searchParams.get('action')  || undefined;
    const fromStr = searchParams.get('from')    || undefined;
    const toStr   = searchParams.get('to')      || undefined;
    const page    = Math.max(1, parseInt(searchParams.get('page')  || '1',  10));
    const limit   = Math.max(1, parseInt(searchParams.get('limit') || '50', 10));

    // Sana validatsiyasi
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (fromStr !== undefined) {
      fromDate = new Date(fromStr);
      if (isNaN(fromDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid 'from' date" },
          { status: 400 }
        );
      }
    }

    if (toStr !== undefined) {
      toDate = new Date(toStr);
      if (isNaN(toDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid 'to' date" },
          { status: 400 }
        );
      }
    }

    // from > to tekshiruvi
    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        { error: "'from' date cannot be greater than 'to' date" },
        { status: 400 }
      );
    }

    const where = {
      ...(userId ? { userId } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
      ...((fromDate || toDate)
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate   ? { lte: toDate   } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('[audit-logs GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
