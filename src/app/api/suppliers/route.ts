import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const suppliers = await prisma.supplier.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/pharmacy:manage_suppliers');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json() as {
      name?: string;
      phone?: string;
      address?: string;
    };

    const { name, phone, address } = body;

    if (!name) {
      return NextResponse.json({ error: 'name majburiy' }, { status: 400 });
    }

    const existing = await prisma.supplier.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Bu nomli yetkazib beruvchi allaqachon mavjud' }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone: phone ?? '',
        address: address ?? undefined,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
