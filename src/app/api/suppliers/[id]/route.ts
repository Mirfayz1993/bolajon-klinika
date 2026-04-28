import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { medicines: true },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Yetkazib beruvchi topilmadi' }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/pharmacy:manage_suppliers');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json() as {
      name?: string;
      phone?: string;
      address?: string;
    };

    const { name, phone, address } = body;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Yetkazib beruvchi topilmadi' }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const duplicate = await prisma.supplier.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Bu nomli yetkazib beruvchi allaqachon mavjud' }, { status: 400 });
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/pharmacy:manage_suppliers');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { medicines: { take: 1 } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Yetkazib beruvchi topilmadi' }, { status: 404 });
    }

    if (existing.medicines.length > 0) {
      return NextResponse.json(
        { error: 'Bu yetkazib beruvchiga bog\'liq dorilar mavjud, o\'chirib bo\'lmaydi' },
        { status: 400 }
      );
    }

    await prisma.supplier.delete({ where: { id } });

    return NextResponse.json({ message: 'Yetkazib beruvchi o\'chirildi' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
