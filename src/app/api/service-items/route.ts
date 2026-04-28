import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/lib/api-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(req: NextRequest) {
  const auth = await requireAction('/settings:manage_service_items');
  if (!auth.ok) return auth.response;

  try {
    const { categoryId, name, price, duration } = await req.json() as {
      categoryId: string;
      name: string;
      price: number;
      duration?: number;
    };

    if (!categoryId || !name?.trim() || price === undefined) {
      return NextResponse.json({ error: "categoryId, nom va narx majburiy" }, { status: 400 });
    }
    if (price < 0) return NextResponse.json({ error: "Narx manfiy bo'lmaydi" }, { status: 400 });

    const item = await db.serviceItem.create({
      data: {
        categoryId,
        name: name.trim(),
        price,
        duration: duration ?? null,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
