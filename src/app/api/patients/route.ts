import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

const READ_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.HEAD_NURSE, Role.RECEPTIONIST, Role.HEAD_LAB_TECH, Role.LAB_TECH];
const WRITE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.RECEPTIONIST];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!READ_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: {
      OR?: Array<{
        firstName?: { contains: string; mode: 'insensitive' };
        lastName?: { contains: string; mode: 'insensitive' };
        fatherName?: { contains: string; mode: 'insensitive' };
        phone?: { contains: string };
        jshshir?: { contains: string };
      }>;
    } = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { fatherName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { jshshir: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patient.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ data, total, page, limit, totalPages });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!WRITE_ROLES.includes(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      firstName?: string;
      lastName?: string;
      fatherName?: string;
      phone?: string;
      jshshir?: string;
      birthDate?: string;
      district?: string;
      houseNumber?: string;
      medicalHistory?: string;
      allergies?: string;
      telegramChatId?: string;
    };

    const {
      firstName,
      lastName,
      fatherName,
      phone,
      jshshir,
      birthDate,
      district,
      houseNumber,
      medicalHistory,
      allergies,
      telegramChatId,
    } = body;

    if (!firstName || !lastName || !fatherName || !phone || !jshshir || !birthDate) {
      return NextResponse.json(
        { error: 'firstName, lastName, fatherName, phone, jshshir, birthDate majburiy' },
        { status: 400 }
      );
    }

    if (!/^\d{14}$/.test(jshshir)) {
      return NextResponse.json(
        { error: 'jshshir 14 ta raqamdan iborat bo\'lishi kerak' },
        { status: 400 }
      );
    }

    const existing = await prisma.patient.findUnique({ where: { jshshir } });
    if (existing) {
      return NextResponse.json(
        { error: 'Bu jshshir allaqachon mavjud' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(birthDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'birthDate noto\'g\'ri format' }, { status: 400 });
    }

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        fatherName,
        phone,
        jshshir,
        birthDate: parsedDate,
        district: district ?? undefined,
        houseNumber: houseNumber ?? undefined,
        medicalHistory: medicalHistory ?? undefined,
        allergies: allergies ?? undefined,
        telegramChatId: telegramChatId ?? undefined,
      },
    });

    return NextResponse.json(patient, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
