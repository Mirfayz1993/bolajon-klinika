import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role') as Role | null;
    const specializationId = searchParams.get('specializationId');
    const isActiveParam = searchParams.get('isActive');

    const where: {
      isActive?: boolean;
      role?: Role;
      specializationId?: string;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; phone?: { contains: string } }>;
    } = {};

    if (isActiveParam !== null) {
      where.isActive = isActiveParam !== 'false';
    }

    if (role && Object.values(Role).includes(role)) {
      where.role = role;
    }

    if (specializationId) {
      where.specializationId = specializationId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        specializationId: true,
        specialization: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      password?: string;
      role?: string;
      specializationId?: string;
    };

    const { firstName, lastName, phone, email, password, role, specializationId } = body;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'firstName va lastName majburiy' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'phone majburiy' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'password majburiy' }, { status: 400 });
    }

    if (!role || !Object.values(Role).includes(role as Role)) {
      return NextResponse.json({ error: 'role notogri' }, { status: 400 });
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return NextResponse.json({ error: 'Bu telefon raqam allaqachon mavjud' }, { status: 400 });
      }
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return NextResponse.json({ error: 'Bu email allaqachon mavjud' }, { status: 400 });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        phone: phone,
        email: email ?? undefined,
        password: passwordHash,
        role: role as Role,
        specializationId: specializationId ?? undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        specializationId: true,
        specialization: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
