import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptPassword, decryptPassword } from '@/lib/encrypt';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        specializationId: true,
        encryptedPassword: true,
        specialization: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Xodim topilmadi' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'ADMIN';
    const { encryptedPassword, ...rest } = user;
    return NextResponse.json({
      ...rest,
      plainPassword: isAdmin && encryptedPassword ? decryptPassword(encryptedPassword) : null,
    });
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

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Xodim topilmadi' }, { status: 404 });
    }

    const body = await req.json() as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      password?: string;
      role?: string;
      specializationId?: string | null;
      isActive?: boolean;
    };

    const { firstName, lastName, phone, email, password, role, specializationId, isActive } = body;

    const updateData: {
      name?: string;
      phone?: string;
      email?: string | null;
      password?: string;
      encryptedPassword?: string;
      role?: Role;
      specializationId?: string | null;
      isActive?: boolean;
    } = {};

    if (firstName !== undefined || lastName !== undefined) {
      const currentParts = existing.name.split(' ');
      const currentFirst = currentParts[0] ?? '';
      const currentLast = currentParts.slice(1).join(' ') ?? '';
      const newFirst = firstName ?? currentFirst;
      const newLast = lastName ?? currentLast;
      updateData.name = `${newFirst} ${newLast}`.trim();
    }

    if (phone !== undefined) {
      const phoneClean = phone.replace(/\s/g, '');
      const duplicate = await prisma.user.findFirst({
        where: { phone: phoneClean, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Bu telefon raqam allaqachon mavjud' }, { status: 400 });
      }
      updateData.phone = phoneClean;
    }

    if (email !== undefined) {
      if (email !== null && email !== '') {
        const duplicate = await prisma.user.findFirst({
          where: { email, id: { not: id } },
        });
        if (duplicate) {
          return NextResponse.json({ error: 'Bu email allaqachon mavjud' }, { status: 400 });
        }
        updateData.email = email;
      } else {
        updateData.email = null;
      }
    }

    if (password !== undefined && password !== '') {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.encryptedPassword = encryptPassword(password);
    }

    if (role !== undefined) {
      if (!Object.values(Role).includes(role as Role)) {
        return NextResponse.json({ error: 'role notogri' }, { status: 400 });
      }
      updateData.role = role as Role;
    }

    if (specializationId !== undefined) {
      updateData.specializationId = specializationId;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        specializationId: true,
        encryptedPassword: true,
        specialization: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    const { encryptedPassword: ep2, ...updatedRest } = updated;
    return NextResponse.json({
      ...updatedRest,
      plainPassword: ep2 ? decryptPassword(ep2) : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    if (session.user.id === id) {
      return NextResponse.json({ error: 'O\'zingizni o\'chira olmaysiz' }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Xodim topilmadi' }, { status: 404 });
    }

    // Soft delete: foydalanuvchi yozuvlari saqlanib qoladi (audit, tibbiy yozuvlar)
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
