import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const admission = await prisma.admission.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fatherName: true,
            phone: true,
            birthDate: true,
          },
        },
        bed: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!admission) {
      return NextResponse.json({ error: 'Yotqizish topilmadi' }, { status: 404 });
    }

    return NextResponse.json(admission);
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

  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.admission.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Yotqizish topilmadi' }, { status: 404 });
    }

    if (existing.dischargeDate !== null) {
      return NextResponse.json(
        { error: 'Chiqarilgan yotqizishni tahrirlash mumkin emas' },
        { status: 400 }
      );
    }

    const body = await req.json() as {
      diagnosis?: string;
      notes?: string;
    };

    const { diagnosis, notes } = body;

    const updateData: { notes?: string } = {};

    // diagnosis and notes both map to the notes field in schema
    if (diagnosis !== undefined) updateData.notes = diagnosis;
    else if (notes !== undefined) updateData.notes = notes;

    const admission = await prisma.admission.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        bed: {
          include: { room: true },
        },
      },
    });

    return NextResponse.json(admission);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
