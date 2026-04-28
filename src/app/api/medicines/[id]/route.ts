import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

// ─── GET /api/medicines/[id] ────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: {
        supplier: true,
        writtenOffBy: { select: { id: true, name: true } },
      },
    });

    if (!medicine) {
      return NextResponse.json({ error: 'Dori topilmadi' }, { status: 404 });
    }

    return NextResponse.json(medicine);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ─── PUT /api/medicines/[id] ─────────────────────────────────────────────────
// floor va writtenOff qo'llab-quvvatlanadi.
// writtenOff=true bo'lganda quantity=0 ga tushiriladi, writtenOffAt va
// writtenOffById saqlanadi.
// quantity bu yerda to'g'ridan-to'g'ri o'zgartirilishi MUMKIN EMAS.

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/pharmacy:edit');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await params;
    const body = await req.json() as {
      name?: string;
      unit?: string;
      type?: string;
      minStock?: number;
      price?: number;
      supplierId?: string;
      expiryDate?: string;
      floor?: number | null;
      writtenOff?: boolean;
      quantity?: unknown;
    };

    // quantity bu yerda o'zgartirilishi MUMKIN EMAS — faqat transaction orqali
    if (body.quantity !== undefined) {
      return NextResponse.json(
        { error: 'quantity ni bu yerda o\'zgartirish mumkin emas. Faqat medicine-transactions orqali.' },
        { status: 400 }
      );
    }

    const existing = await prisma.medicine.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Dori topilmadi' }, { status: 404 });
    }

    // Allaqachon write-off qilingan dorini qayta write-off qilib bo'lmaydi
    if (body.writtenOff === true && existing.writtenOff) {
      return NextResponse.json(
        { error: 'Bu dori allaqachon hisobdan chiqarilgan' },
        { status: 400 }
      );
    }

    // write-off ni qaytarib bo'lmaydi (true → false)
    if (body.writtenOff === false && existing.writtenOff) {
      return NextResponse.json(
        { error: 'Hisobdan chiqarilgan dorini qayta tiklash mumkin emas' },
        { status: 400 }
      );
    }

    const { name, minStock, price, supplierId, expiryDate } = body;
    const unitOrType = body.unit ?? body.type;

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        return NextResponse.json({ error: 'Yetkazib beruvchi topilmadi' }, { status: 404 });
      }
    }

    let parsedExpiry: Date | undefined;
    if (expiryDate) {
      parsedExpiry = new Date(expiryDate);
      if (isNaN(parsedExpiry.getTime())) {
        return NextResponse.json({ error: 'expiryDate noto\'g\'ri format' }, { status: 400 });
      }
    }

    if (price !== undefined && price < 0) {
      return NextResponse.json({ error: 'price manfiy bo\'lishi mumkin emas' }, { status: 400 });
    }

    if (minStock !== undefined && minStock < 0) {
      return NextResponse.json({ error: 'minStock manfiy bo\'lishi mumkin emas' }, { status: 400 });
    }

    // floor validatsiya: undefined (o'zgartirilmaydi), null, 2 yoki 3
    if (
      body.floor !== undefined &&
      body.floor !== null &&
      body.floor !== 2 &&
      body.floor !== 3
    ) {
      return NextResponse.json(
        { error: 'floor faqat null, 2 yoki 3 bo\'lishi mumkin' },
        { status: 400 }
      );
    }

    // write-off bo'lganda: quantity=0, writtenOffAt, writtenOffById set qilinadi
    const writeOffData =
      body.writtenOff === true
        ? {
            writtenOff: true,
            quantity: 0,
            writtenOffAt: new Date(),
            writtenOffById: session.user.id,
          }
        : {};

    const medicine = await prisma.medicine.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(unitOrType !== undefined && { type: unitOrType }),
        ...(minStock !== undefined && { minStock }),
        ...(price !== undefined && { price }),
        ...(supplierId !== undefined && { supplierId }),
        ...(parsedExpiry !== undefined && { expiryDate: parsedExpiry }),
        // floor: body da kalit bo'lsa (undefined emas) — yangilash
        ...(body.floor !== undefined && { floor: body.floor }),
        ...writeOffData,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        writtenOffBy: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      module: 'pharmacy',
      details: {
        medicineId: medicine.id,
        oldName: existing.name,
        newName: medicine.name,
        oldPrice: Number(existing.price),
        newPrice: Number(medicine.price),
        oldMinStock: existing.minStock,
        newMinStock: medicine.minStock,
        ...(body.writtenOff === true && {
          action: 'writeoff_via_put',
          writtenOff: true,
        }),
      },
    });

    return NextResponse.json(medicine);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ─── PATCH /api/medicines/[id]/write-off ni shu faylda alohida action sifatida
// Agar faqat write-off uchun tez endpoint kerak bo'lsa, PATCH ishlatiladi.
// Body: { reason?: string } — ixtiyoriy sabab
// Natija: medicine.writtenOff=true, quantity=0, writtenOffAt va writtenOffById to'ldiriladi.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/pharmacy:writeoff');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await params;

    const existing = await prisma.medicine.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Dori topilmadi' }, { status: 404 });
    }

    if (existing.writtenOff) {
      return NextResponse.json(
        { error: 'Bu dori allaqachon hisobdan chiqarilgan' },
        { status: 400 }
      );
    }

    const medicine = await prisma.medicine.update({
      where: { id },
      data: {
        writtenOff: true,
        quantity: 0,
        writtenOffAt: new Date(),
        writtenOffById: session.user.id,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        writtenOffBy: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      module: 'pharmacy',
      details: {
        medicineId: medicine.id,
        name: medicine.name,
        action: 'writeoff',
        previousQuantity: existing.quantity,
      },
    });

    return NextResponse.json(medicine);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ─── DELETE /api/medicines/[id] ──────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/pharmacy:edit');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { id } = await params;

    const existing = await prisma.medicine.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Dori topilmadi' }, { status: 404 });
    }

    if (existing.quantity !== 0) {
      return NextResponse.json(
        { error: 'Faqat quantity=0 bo\'lgan dorilarni o\'chirish mumkin' },
        { status: 400 }
      );
    }

    await prisma.medicine.delete({ where: { id } });

    await writeAuditLog({
      userId: session.user.id,
      action: 'DELETE',
      module: 'pharmacy',
      details: {
        medicineId: existing.id,
        name: existing.name,
      },
    });

    return NextResponse.json({ message: 'Dori o\'chirildi' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
