import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { requireAction } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;

    const patient = await prisma.patient.findUnique({
      where: { id, deletedAt: null }, // Soft delete: faqat faol bemorlarni ko'rsat
    });

    if (!patient) {
      return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
    }

    return NextResponse.json(patient);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/patients:edit');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const existing = await prisma.patient.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
    }

    const body = await req.json() as {
      firstName?: string;
      lastName?: string;
      fatherName?: string;
      phone?: string;
      jshshir?: string;
      birthDate?: string;
      district?: string | null;
      houseNumber?: string | null;
      medicalHistory?: string | null;
      allergies?: string | null;
      chronicConditions?: string | null;
      telegramChatId?: string | null;
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
      chronicConditions,
      telegramChatId,
    } = body;

    const updateData: {
      firstName?: string;
      lastName?: string;
      fatherName?: string;
      phone?: string;
      jshshir?: string;
      birthDate?: Date;
      district?: string | null;
      houseNumber?: string | null;
      medicalHistory?: string | null;
      allergies?: string | null;
      chronicConditions?: string | null;
      telegramChatId?: string | null;
    } = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (fatherName !== undefined) updateData.fatherName = fatherName;
    if (phone !== undefined) updateData.phone = phone.replace(/[\s\-]/g, '');

    if (jshshir !== undefined) {
      if (!/^\d{14}$/.test(jshshir)) {
        return NextResponse.json(
          { error: 'jshshir 14 ta raqamdan iborat bo\'lishi kerak' },
          { status: 400 }
        );
      }

      const duplicate = await prisma.patient.findFirst({
        where: { jshshir, id: { not: id }, deletedAt: null },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Bu jshshir allaqachon mavjud' },
          { status: 400 }
        );
      }

      updateData.jshshir = jshshir;
    }

    if (birthDate !== undefined) {
      const parsedDate = new Date(birthDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'birthDate noto\'g\'ri format' }, { status: 400 });
      }
      updateData.birthDate = parsedDate;
    }

    if (district !== undefined) updateData.district = district;
    if (houseNumber !== undefined) updateData.houseNumber = houseNumber;
    if (medicalHistory !== undefined) updateData.medicalHistory = medicalHistory;
    if (allergies !== undefined) updateData.allergies = allergies;
    if (chronicConditions !== undefined) updateData.chronicConditions = chronicConditions;
    if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId;

    const updated = await prisma.patient.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAction('/patients:delete');
  if (!auth.ok) return auth.response;
  const session = auth.session;

  try {
    const { id } = await params;

    const existing = await prisma.patient.findUnique({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Bemor topilmadi' }, { status: 404 });
    }

    // Soft delete: ma'lumotlar saqlanib qoladi, faqat o'chirilgan deb belgilanadi
    await prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: 'DELETE',
      module: 'patients',
      details: { patientId: id, name: `${existing.lastName} ${existing.firstName}` },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
