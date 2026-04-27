import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
import { requireSession } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const patient = await prisma.patient.findFirst({
      where: { id: id, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, fatherName: true },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // QR content: patient ID (scanner bu ID ni o'qiydi va bemor sahifasiga yo'naltiradi)
    const qrContent = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/patients/${patient.id}`;

    const dataUrl = await QRCode.toDataURL(qrContent, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return NextResponse.json({ dataUrl, patientId: patient.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
