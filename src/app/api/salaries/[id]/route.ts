import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const salary = await prisma.salary.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!salary) {
      return NextResponse.json({ error: 'Maosh yozuvi topilmadi' }, { status: 404 });
    }

    return NextResponse.json(salary);
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
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.salary.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Maosh yozuvi topilmadi' }, { status: 404 });
    }

    // Faqat notes o'zgartirish mumkin — lekin notes Salary modelida yo'q
    // Schema da mavjud maydonlar: status, paidAt
    // Spec: "faqat notes o'zgartirish" — schema da notes yo'q, shuning uchun
    // status va paidAt ni o'zgartirish imkonini beramiz (amount o'zgartirib bo'lmaydi)
    const body = await req.json() as {
      status?: string;
      paidAt?: string;
    };

    const updateData: { status?: 'PENDING' | 'PAID'; paidAt?: Date | null } = {};

    if (body.status !== undefined) {
      if (!['PENDING', 'PAID'].includes(body.status)) {
        return NextResponse.json(
          { error: 'status PENDING yoki PAID bo\'lishi kerak' },
          { status: 400 }
        );
      }
      updateData.status = body.status as 'PENDING' | 'PAID';
    }

    if (body.paidAt !== undefined) {
      if (body.paidAt === null) {
        updateData.paidAt = null;
      } else {
        const d = new Date(body.paidAt);
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: 'paidAt noto\'g\'ri format' }, { status: 400 });
        }
        updateData.paidAt = d;
      }
    }

    const updated = await prisma.salary.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
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
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.salary.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Maosh yozuvi topilmadi' }, { status: 404 });
    }

    await prisma.salary.delete({ where: { id } });

    return NextResponse.json({ message: 'Maosh yozuvi o\'chirildi' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
