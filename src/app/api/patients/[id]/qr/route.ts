import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const patient = await prisma.patient.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, fatherName: true },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // QR content: patient ID (scanner bu ID ni o'qiydi va bemor sahifasiga yo'naltiradi)
    const qrContent = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/patients/${patient.id}`;

    const dataUrl = await QRCode.toDataURL(qrContent, {
      width: 300,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    });

    return NextResponse.json({ dataUrl, patientId: patient.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
