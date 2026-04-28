import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const categories = await db.serviceCategory.findMany({
      where: { isActive: true },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    // Prisma Decimal → Number (JSON da string bo'lib keladi)
    const result = categories.map((cat: { items: { price: unknown }[] }) => ({
      ...cat,
      items: cat.items.map((item: { price: unknown }) => ({
        ...item,
        price: Number(item.price),
      })),
    }));
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/settings:manage_service_categories');
  if (!auth.ok) return auth.response;

  try {
    const { name } = await req.json() as { name: string };
    if (!name?.trim()) return NextResponse.json({ error: 'Nom majburiy' }, { status: 400 });

    const category = await db.serviceCategory.create({
      data: { name: name.trim() },
      include: { items: true },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Bu nom allaqachon mavjud' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
