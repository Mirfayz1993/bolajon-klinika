import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

const READ_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.DOCTOR, Role.HEAD_NURSE, Role.NURSE, Role.RECEPTIONIST, Role.HEAD_LAB_TECH, Role.LAB_TECH, Role.SPEECH_THERAPIST, Role.MASSAGE_THERAPIST];
const WRITE_ROLES: Role[] = [Role.ADMIN, Role.HEAD_DOCTOR, Role.RECEPTIONIST];

// --- Transliteration helpers --------------------------------------------------

const LAT_TO_CYR: [string, string][] = [
  ["o'", 'ў'], ["g'", 'ғ'], ["sh", 'ш'], ["ch", 'ч'], ["ts", 'ц'],
  ['a', 'а'], ['b', 'б'], ['d', 'д'], ['e', 'е'], ['f', 'ф'],
  ['g', 'г'], ['h', 'х'], ['i', 'и'], ['j', 'ж'], ['k', 'к'],
  ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'],
  ['q', 'к'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'],
  ['v', 'в'], ['x', 'х'], ['y', 'й'], ['z', 'з'],
];

const CYR_TO_LAT: [string, string][] = [
  ['ш', 'sh'], ['ч', 'ch'], ['ж', 'j'], ['ғ', "g'"], ['ў', "o'"],
  ['ц', 'ts'], ['щ', 'sh'], ['ё', 'yo'], ['ю', 'yu'], ['я', 'ya'],
  ['а', 'a'], ['б', 'b'], ['в', 'v'], ['г', 'g'], ['д', 'd'],
  ['е', 'e'], ['з', 'z'], ['и', 'i'], ['й', 'y'], ['к', 'k'],
  ['л', 'l'], ['м', 'm'], ['н', 'n'], ['о', 'o'], ['п', 'p'],
  ['р', 'r'], ['с', 's'], ['т', 't'], ['у', 'u'], ['ф', 'f'],
  ['х', 'x'], ['ъ', ''], ['ы', 'i'], ['ь', ''], ['э', 'e'],
  ['қ', 'q'], ['ҳ', 'h'], ['ҷ', 'j'], ['ӯ', "o'"],
];

function latinToCyrillic(s: string): string {
  let r = s.toLowerCase();
  for (const [lat, cyr] of LAT_TO_CYR) r = r.split(lat).join(cyr);
  return r;
}

function cyrillicToLatin(s: string): string {
  let r = s.toLowerCase();
  for (const [cyr, lat] of CYR_TO_LAT) r = r.split(cyr).join(lat);
  return r;
}

function isCyrillic(s: string): boolean {
  return /[\u0400-\u04FF]/.test(s);
}

function getSearchTerms(raw: string): string[] {
  const terms = new Set<string>();
  terms.add(raw);
  if (isCyrillic(raw)) {
    terms.add(cyrillicToLatin(raw));
  } else {
    terms.add(latinToCyrillic(raw));
  }
  return [...terms].filter(Boolean);
}

// ------------------------------------------------------------------------------

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

    type WhereClause = {
      deletedAt: null;
      OR?: Array<{
        firstName?: { contains: string; mode: 'insensitive' };
        lastName?: { contains: string; mode: 'insensitive' };
        fatherName?: { contains: string; mode: 'insensitive' };
        phone?: { contains: string };
        jshshir?: { contains: string };
      }>;
    };

    const where: WhereClause = { deletedAt: null };

    if (search) {
      const raw = search.trim();
      const terms = getSearchTerms(raw);
      const phoneNorm = raw.replace(/[\s\-]/g, '');
      const phoneTerms = new Set<string>([phoneNorm, ...terms.map(t => t.replace(/[\s\-]/g, ''))]);
      where.OR = [
        ...terms.flatMap(term => [
          { firstName: { contains: term, mode: 'insensitive' as const } },
          { lastName: { contains: term, mode: 'insensitive' as const } },
          { fatherName: { contains: term, mode: 'insensitive' as const } },
        ]),
        ...[...phoneTerms].map(t => ({ phone: { contains: t } })),
        { jshshir: { contains: raw } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          assignedServices: {
            where: { isPaid: false },
            select: { price: true },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const enriched = data.map(({ assignedServices, ...p }) => ({
      ...p,
      pendingDebt: assignedServices.reduce((sum, s) => sum + Number(s.price), 0),
    }));

    return NextResponse.json({ data: enriched, total, page, limit, totalPages });
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
      gender?: string;
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
      gender,
      district,
      houseNumber,
      medicalHistory,
      allergies,
      telegramChatId,
    } = body;

    if (!firstName || !lastName || !fatherName || !phone || !birthDate) {
      return NextResponse.json(
        { error: 'firstName, lastName, fatherName, phone, birthDate majburiy' },
        { status: 400 }
      );
    }

    if (jshshir && !/^\d{14}$/.test(jshshir)) {
      return NextResponse.json(
        { error: 'jshshir 14 ta raqamdan iborat bo\'lishi kerak' },
        { status: 400 }
      );
    }

    const existing = jshshir ? await prisma.patient.findUnique({ where: { jshshir } }) : null;
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
        phone: phone.replace(/[\s\-]/g, ''),
        jshshir,
        birthDate: parsedDate,
        gender: gender ?? undefined,
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
