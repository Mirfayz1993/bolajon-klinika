import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction, requireSession } from '@/lib/api-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

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
  const auth = await requireAction('/patients:create_note');
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;

  try {
    const body = await req.json() as {
      procedure: string;
      notes?: string;
      admissionId?: string;
      medicines?: { name: string; quantity: number; unit: string }[];
      noteType?: string;
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
        noteType: body.noteType || null,
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
