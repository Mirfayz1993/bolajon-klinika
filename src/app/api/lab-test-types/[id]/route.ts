import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const labTestType = await prisma.labTestType.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        normalRange: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!labTestType) {
      return NextResponse.json({ error: 'Tahlil turi topilmadi' }, { status: 404 });
    }

    return NextResponse.json(labTestType);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowedRoles = ['ADMIN', 'HEAD_LAB_TECH'];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.labTestType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tahlil turi topilmadi' }, { status: 404 });
    }

    const body = await req.json() as {
      name?: string;
      description?: string;
      price?: number;
      normalRange?: string;
      isActive?: boolean;
    };

    const { name, description, price, normalRange, isActive } = body;

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json(
        { error: 'price musbat son bo\'lishi kerak' },
        { status: 400 }
      );
    }

    if (name && name !== existing.name) {
      const duplicate = await prisma.labTestType.findUnique({ where: { name } });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Bu nom bilan tahlil turi allaqachon mavjud' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.labTestType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(normalRange !== undefined && { normalRange }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.labTestType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Tahlil turi topilmadi' }, { status: 404 });
    }

    const linkedTests = await prisma.labTest.count({ where: { testTypeId: id } });
    if (linkedTests > 0) {
      return NextResponse.json(
        { error: 'Bu tahlil turi ishlatilgan, o\'chirib bo\'lmaydi' },
        { status: 400 }
      );
    }

    await prisma.labTestType.delete({ where: { id } });

    return NextResponse.json({ message: 'Tahlil turi o\'chirildi' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
