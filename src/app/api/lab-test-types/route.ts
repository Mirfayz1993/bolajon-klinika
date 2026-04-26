import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const where: {
      isActive: boolean;
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        description?: { contains: string; mode: 'insensitive' };
      }>;
    } = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.labTestType.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        normalRange: true,
        normalMin: true,
        normalMax: true,
        unit: true,
        category: true,
        isActive: true,
        parentId: true,
        createdAt: true,
        children: {
          select: { id: true, name: true, normalRange: true, normalMin: true, normalMax: true, unit: true, price: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowedRoles = ['ADMIN', 'HEAD_LAB_TECH'];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      name?: string;
      description?: string;
      price?: number;
      normalRange?: string;
      normalMin?: number | null;
      normalMax?: number | null;
      unit?: string;
      category?: string;
      parentId?: string;
    };

    const { name, description, price, normalRange, normalMin, normalMax, unit, category, parentId } = body;

    if (!name || price === undefined || price === null) {
      return NextResponse.json(
        { error: 'name va price majburiy' },
        { status: 400 }
      );
    }

    // category required only for top-level types (not sub-tests)
    if (!parentId && (!category || !category.trim())) {
      return NextResponse.json(
        { error: 'Guruh nomi majburiy' },
        { status: 400 }
      );
    }

    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json(
        { error: 'price musbat son bo\'lishi kerak' },
        { status: 400 }
      );
    }

    // Validate parentId if provided
    if (parentId) {
      const parent = await prisma.labTestType.findUnique({ where: { id: parentId } });
      if (!parent) return NextResponse.json({ error: 'Panel topilmadi' }, { status: 404 });
      // Sub-tests cannot have sub-tests (max 1 level)
      if (parent.parentId) return NextResponse.json({ error: 'Sub-testning sub-testi bo\'lmaydi' }, { status: 400 });
    }

    const existing = await prisma.labTestType.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: 'Bu nom bilan tahlil turi allaqachon mavjud' },
        { status: 400 }
      );
    }

    const labTestType = await prisma.labTestType.create({
      data: {
        name,
        description: description ?? undefined,
        price,
        normalRange: normalRange ?? undefined,
        normalMin: normalMin ?? undefined,
        normalMax: normalMax ?? undefined,
        unit: unit ?? undefined,
        category: category?.trim() ?? undefined,
        parentId: parentId ?? undefined,
      },
    });

    return NextResponse.json(labTestType, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
