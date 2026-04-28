import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
        normalMin: true,
        normalMax: true,
        unit: true,
        category: true,
        isActive: true,
        parentId: true,
        createdAt: true,
        children: {
          select: { id: true, name: true, normalRange: true, normalMin: true, normalMax: true, unit: true, price: true },
          orderBy: { createdAt: 'asc' },
        },
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
  const auth = await requireAction('/lab:edit_test');
  if (!auth.ok) return auth.response;

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
      normalMin?: number | null;
      normalMax?: number | null;
      unit?: string;
      category?: string;
      isActive?: boolean;
      parentId?: string | null;
    };

    const { name, description, price, normalRange, normalMin, normalMax, unit, category, isActive, parentId } = body;

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

    // Validate parentId if changing
    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) return NextResponse.json({ error: 'O\'ziga parent bo\'lmaydi' }, { status: 400 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent = await (prisma as any).labTestType.findUnique({ where: { id: parentId } });
      if (!parent) return NextResponse.json({ error: 'Panel topilmadi' }, { status: 404 });
      if (parent.parentId) return NextResponse.json({ error: 'Sub-testning sub-testi bo\'lmaydi' }, { status: 400 });
    }

    const updated = await prisma.labTestType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(normalRange !== undefined && { normalRange }),
        ...(normalMin !== undefined && { normalMin }),
        ...(normalMax !== undefined && { normalMax }),
        ...(unit !== undefined && { unit }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(parentId !== undefined && { parentId }),
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
  const auth = await requireAction('/lab:delete');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db2 = prisma as any;
    const existing = await db2.labTestType.findUnique({
      where: { id },
      include: { children: { select: { id: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Tahlil turi topilmadi' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;

    // Barcha o'chiriladigan typeId lar (o'zi + sub-testlari)
    const childIds = existing.children.map((c: { id: string }) => c.id);
    const allTypeIds = [id, ...childIds];

    // Bog'liq LabTest lar va ularning Payment ID lari
    const linkedTests = await db.labTest.findMany({
      where: { testTypeId: { in: allTypeIds } },
      select: { id: true, paymentId: true },
    });

    if (linkedTests.length > 0) {
      const paymentIds = linkedTests.map((t: { paymentId: string | null }) => t.paymentId).filter(Boolean) as string[];
      await prisma.labTest.deleteMany({ where: { testTypeId: { in: allTypeIds } } });
      if (paymentIds.length > 0) {
        await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
      }
    }

    // Sub-testlarni o'chirish, keyin asosiy turni
    if (childIds.length > 0) {
      await prisma.labTestType.deleteMany({ where: { id: { in: childIds } } });
    }
    await prisma.labTestType.delete({ where: { id } });

    return NextResponse.json({ message: 'Tahlil turi o\'chirildi' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
