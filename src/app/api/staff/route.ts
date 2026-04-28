import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptPassword, decryptPassword } from '@/lib/encrypt';
import { requireSession, requireAction } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const { session } = auth;

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
        encryptedPassword: true,
        specialization: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    const isAdmin = session.user.role === 'ADMIN';
    const result = users.map(({ encryptedPassword, ...u }) => ({
      ...u,
      plainPassword: isAdmin && encryptedPassword ? decryptPassword(encryptedPassword) : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAction('/staff:create');
  if (!auth.ok) return auth.response;

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

    const { firstName, lastName, email, password, role, specializationId } = body;
    const phone = typeof body.phone === 'string' ? body.phone.replace(/\s/g, '') : body.phone;

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
        encryptedPassword: encryptPassword(password),
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
        encryptedPassword: true,
        specialization: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    const { encryptedPassword: ep, ...rest } = user;
    return NextResponse.json({ ...rest, plainPassword: ep ? decryptPassword(ep) : null }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
