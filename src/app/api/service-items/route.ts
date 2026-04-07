import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
