import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/api-auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { id: patientId } = await params;

  try {
    const [appointments, medicalRecords, labTests, nurseNotes, admissions, assignedServices] =
      await Promise.all([
        prisma.appointment.findMany({
          where: { patientId },
          include: {
            doctor: { select: { name: true } },
            queue: true,
          },
          orderBy: { dateTime: 'asc' },
        }),
        prisma.medicalRecord.findMany({
          where: { patientId },
          include: {
            doctor: { select: { name: true } },
            prescriptions: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.labTest.findMany({
          where: { patientId },
          include: {
            testType: { select: { name: true } },
            labTech: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.nurseNote.findMany({
          where: { patientId },
          include: { nurse: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.admission.findMany({
          where: { patientId },
          include: {
            bed: { include: { room: { select: { floor: true, roomNumber: true } } } },
          },
          orderBy: { admissionDate: 'asc' },
        }),
        prisma.assignedService.findMany({
          where: { patientId },
          orderBy: { assignedAt: 'asc' },
        }),
      ]);

    type TimelineEvent = {
      id: string;
      time: string;
      type: string;
      title: string;
      detail?: string;
      color: string;
    };

    const events: TimelineEvent[] = [];

    // Appointments + Queue
    for (const appt of appointments) {
      events.push({
        id: `appt-${appt.id}`,
        time: appt.dateTime.toISOString(),
        type: 'appointment',
        title: `Qabul rejalashtirildi — ${appt.doctor.name}`,
        detail: appt.notes ?? undefined,
        color: 'blue',
      });

      if (appt.queue) {
        events.push({
          id: `queue-${appt.queue.id}`,
          time: appt.queue.createdAt.toISOString(),
          type: 'queue',
          title: `Navbatga qo'yildi — #${appt.queue.queueNumber}`,
          detail: appt.queue.isUrgent ? 'Shoshilinch' : undefined,
          color: 'slate',
        });

        if (appt.queue.calledAt) {
          events.push({
            id: `queue-called-${appt.queue.id}`,
            time: appt.queue.calledAt.toISOString(),
            type: 'queue_called',
            title: `Navbat chaqirildi — #${appt.queue.queueNumber}`,
            color: 'yellow',
          });
        }

        if (appt.queue.doneAt) {
          events.push({
            id: `queue-done-${appt.queue.id}`,
            time: appt.queue.doneAt.toISOString(),
            type: 'queue_done',
            title: `Qabul tugadi — ${appt.doctor.name}`,
            color: 'green',
          });
        }
      }
    }

    // Medical records
    for (const rec of medicalRecords) {
      const parts = [
        rec.diagnosis ? `Tashxis: ${rec.diagnosis}` : null,
        rec.treatment ? `Davolash: ${rec.treatment}` : null,
      ].filter(Boolean).join(' | ');

      events.push({
        id: `record-${rec.id}`,
        time: rec.createdAt.toISOString(),
        type: 'medical_record',
        title: `Tashxis qo'yildi — ${rec.doctor.name}`,
        detail: parts || undefined,
        color: 'indigo',
      });

      for (const rx of rec.prescriptions) {
        events.push({
          id: `rx-${rx.id}`,
          time: rx.createdAt.toISOString(),
          type: 'prescription',
          title: `Dori yozildi: ${rx.medicineName}`,
          detail: `${rx.dosage}, ${rx.duration}`,
          color: 'purple',
        });
      }
    }

    // Lab tests
    for (const lt of labTests) {
      events.push({
        id: `lab-${lt.id}`,
        time: lt.createdAt.toISOString(),
        type: 'lab_ordered',
        title: `Tahlil tayinlandi: ${lt.testType.name}`,
        detail: lt.labTech ? `Laborant: ${lt.labTech.name}` : undefined,
        color: 'teal',
      });

      if (lt.status === 'COMPLETED' && lt.updatedAt) {
        events.push({
          id: `lab-done-${lt.id}`,
          time: lt.updatedAt.toISOString(),
          type: 'lab_done',
          title: `Tahlil natijasi: ${lt.testType.name}`,
          detail: lt.notes ?? undefined,
          color: 'green',
        });
      }
    }

    // Nurse notes
    for (const nn of nurseNotes) {
      events.push({
        id: `nurse-${nn.id}`,
        time: nn.createdAt.toISOString(),
        type: 'nurse_note',
        title: `Hamshira qaydi — ${nn.nurse.name}`,
        detail: nn.procedure,
        color: 'pink',
      });
    }

    // Admissions
    for (const adm of admissions) {
      const floorNum = adm.bed.room.floor;
      const floorStr = floorNum === 1 ? 'Podval' : `${floorNum - 1}-qavat`;
      const room = `${floorStr}, ${adm.bed.room.roomNumber}-xona`;
      const isAmb = adm.admissionType === 'AMBULATORY';
      events.push({
        id: `adm-${adm.id}`,
        time: adm.admissionDate.toISOString(),
        type: 'admission',
        title: `${isAmb ? 'Ambulatorga' : 'Statsionarga'} yotqizildi — ${room}`,
        color: 'orange',
      });

      if (adm.dischargeDate) {
        events.push({
          id: `adm-out-${adm.id}`,
          time: adm.dischargeDate.toISOString(),
          type: 'discharge',
          title: `${isAmb ? 'Ambulatordan' : 'Statsionardan'} chiqarildi — ${room}`,
          color: 'slate',
        });
      }
    }

    // Assigned services
    for (const svc of assignedServices) {
      events.push({
        id: `svc-${svc.id}`,
        time: svc.assignedAt.toISOString(),
        type: 'service',
        title: `Xizmat tayinlandi: ${svc.itemName}`,
        detail: svc.categoryName,
        color: 'cyan',
      });
    }

    // Sort by time desc (eng yangi birinchi)
    events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return NextResponse.json({ events });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
