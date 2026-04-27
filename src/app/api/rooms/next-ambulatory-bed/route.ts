import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/rooms/next-ambulatory-bed
// Round-robin tarzda keyingi bo'sh ambulator to'shakni qaytaradi.
// Algoritm:
//  1. Barcha ambulator xonalardagi to'shaklarni olib, room.roomNumber asc -> bed.bedNumber asc tartibida flat ro'yxat tuziladi
//  2. Eng oxirgi yaratilgan AMBULATORY admission topiladi
//  3. Uning bedId'si flat ro'yxatda topilib, undan keyingi pozitsiyadan boshlab birinchi bo'sh to'shak qaytariladi (modulo)
//  4. Hech qanday bo'sh to'shak bo'lmasa { roomId: null, bedId: null }
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1) Barcha ambulator xonalardagi to'shaklarni 1 ta query bilan olamiz.
    //    Aktiv admission borligini bilish uchun dischargeDate = null bo'lganlarni include qilamiz.
    const ambulatoryBeds = await prisma.bed.findMany({
      where: {
        room: { isAmbulatory: true },
      },
      select: {
        id: true,
        bedNumber: true,
        roomId: true,
        room: { select: { id: true, roomNumber: true } },
        admissions: {
          where: { dischargeDate: null },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (ambulatoryBeds.length === 0) {
      return NextResponse.json({ roomId: null, bedId: null });
    }

    // 2) Determined tartib: room.roomNumber asc -> bed.bedNumber asc
    //    String comparison localeCompare numeric: true bilan "1","2","10" tartibini to'g'ri saqlaydi
    const flatList = [...ambulatoryBeds].sort((a, b) => {
      const roomCmp = a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (roomCmp !== 0) return roomCmp;
      return a.bedNumber.localeCompare(b.bedNumber, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    const isFree = (bed: (typeof flatList)[number]) => bed.admissions.length === 0;

    // 3) Eng oxirgi AMBULATORY admission'ni topamiz
    const lastAmbAdmission = await prisma.admission.findFirst({
      where: { admissionType: 'AMBULATORY' },
      orderBy: { createdAt: 'desc' },
      select: { bedId: true },
    });

    // 4) Boshlanish indeksini aniqlaymiz
    let startIdx = 0;
    if (lastAmbAdmission) {
      const lastIdx = flatList.findIndex((b) => b.id === lastAmbAdmission.bedId);
      if (lastIdx >= 0) {
        startIdx = (lastIdx + 1) % flatList.length;
      }
      // Agar lastIdx topilmasa (masalan bed o'chirilgan yoki endi ambulator emas) — boshidan qidiramiz
    }

    // 5) startIdx'dan boshlab tsiklik (modulo) aylantirib birinchi bo'sh to'shakni qidiramiz
    for (let i = 0; i < flatList.length; i++) {
      const idx = (startIdx + i) % flatList.length;
      const bed = flatList[idx];
      if (isFree(bed)) {
        return NextResponse.json({ roomId: bed.roomId, bedId: bed.id });
      }
    }

    // 6) Bo'sh to'shak topilmadi
    return NextResponse.json({ roomId: null, bedId: null });
  } catch (err) {
    console.error('next-ambulatory-bed error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
