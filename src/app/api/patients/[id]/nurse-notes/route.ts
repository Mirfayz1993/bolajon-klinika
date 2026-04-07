import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const NURSE_ROLES = ['ADMIN', 'HEAD_NURSE', 'NURSE', 'HEAD_DOCTOR', 'DOCTOR'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const notes = await db.nurseNote.findMany({
      where: { patientId: id },
      include: {
        nurse: { select: { id: true, name: true, role: true } },
        admission: {
          include: {
            bed: { include: { room: { select: { floor: true, roomNumber: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notes);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!NURSE_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json() as {
      procedure: string;
      notes?: string;
      admissionId?: string;
      medicines?: { name: string; quantity: number; unit: string }[];
    };

    if (!body.procedure?.trim()) {
      return NextResponse.json({ error: 'Muolaja nomi majburiy' }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });

    const note = await db.nurseNote.create({
      data: {
        patientId: id,
        nurseId: session.user.id,
        procedure: body.procedure.trim(),
        notes: body.notes?.trim() || null,
        admissionId: body.admissionId || null,
        medicines: body.medicines?.length ? body.medicines : null,
      },
      include: {
        nurse: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
