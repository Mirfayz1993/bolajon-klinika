'use client';

import {
  User, Phone, Calendar, MapPin, FileText, AlertTriangle, AlertCircle,
  MessageCircle, Hash, BedDouble, Activity, Loader2,
} from 'lucide-react';
import { floorLabel } from '@/lib/utils';
import { InfoRow } from './ui';

// --- Local prop types (minimum kerakli field'lar) -----------------------------

interface InfoTabPatient {
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  jshshir: string;
  birthDate: string;
  district: string | null;
  houseNumber: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  telegramChatId: string | null;
}

interface InfoTabAdmission {
  id: string;
  admissionType: string;
  admissionDate: string;
  dischargeDate?: string | null;
  bed: { bedNumber: string; room: { floor: number; roomNumber: string; type: string } };
}

interface InfoTabTimelineEvent {
  id: string;
  time: string;
  type: string;
  title: string;
  detail?: string;
  color: string;
}

interface InfoTabProps {
  patient: InfoTabPatient;
  admissions: InfoTabAdmission[];
  timeline: InfoTabTimelineEvent[];
  timelineLoading: boolean;
  pt: {
    fields?: {
      fullName?: string;
      birthYear?: string;
      phone?: string;
      district?: string;
      age?: string;
    };
  };
  fmtDate: (dateStr: string) => string;
  calcAge: (birthDate: string) => number;
}

export function InfoTab({ patient, admissions, timeline, timelineLoading, pt, fmtDate, calcAge }: InfoTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <InfoRow icon={<User className="w-4 h-4 text-slate-400" />} label={pt.fields?.fullName ?? "To'liq ismi"}
          value={`${patient.lastName} ${patient.firstName} ${patient.fatherName}`} />
        <InfoRow icon={<Calendar className="w-4 h-4 text-slate-400" />} label={pt.fields?.birthYear ?? "Tug'ilgan yil"}
          value={`${new Date(patient.birthDate).getFullYear()} (${calcAge(patient.birthDate)} ${pt.fields?.age ?? 'yosh'})`} />
        <InfoRow icon={<Phone className="w-4 h-4 text-slate-400" />} label={pt.fields?.phone ?? 'Telefon'} value={patient.phone} />
        {patient.jshshir && <InfoRow icon={<Hash className="w-4 h-4 text-slate-400" />} label="JSHSHIR" value={patient.jshshir} />}
        {patient.district && <InfoRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label={pt.fields?.district ?? 'Tuman'} value={patient.district} />}
        {patient.houseNumber && <InfoRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Uy raqami" value={patient.houseNumber} />}
        {patient.telegramChatId && <InfoRow icon={<MessageCircle className="w-4 h-4 text-slate-400" />} label="Telegram" value={patient.telegramChatId} />}
      </div>

      {patient.allergies && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" /> Allergiyalar
          </div>
          <p className="text-sm text-red-800">{patient.allergies}</p>
        </div>
      )}

      {patient.chronicConditions && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-700 font-medium mb-1">
            <AlertCircle className="w-4 h-4" /> Surunkali kasalliklar
          </div>
          <p className="text-sm text-orange-800">{patient.chronicConditions}</p>
        </div>
      )}

      {patient.medicalHistory && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-700 font-medium mb-2">
            <FileText className="w-4 h-4 text-slate-400" /> Tibbiy tarix
          </div>
          <p className="text-sm text-slate-600">{patient.medicalHistory}</p>
        </div>
      )}

      {/* Admissions summary */}
      {admissions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-700 font-medium mb-3">
            <BedDouble className="w-4 h-4 text-slate-400" /> Yotqizishlar tarixi
          </div>
          <div className="space-y-2">
            {admissions.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-700">
                  {a.admissionType === 'AMBULATORY' ? 'Ambulator' : 'Statsionar'} —{' '}
                  {floorLabel(a.bed.room.floor)}, {a.bed.room.roomNumber}-xona, {a.bed.bedNumber}-karavot
                </span>
                <span className="text-slate-500 text-xs">
                  {fmtDate(a.admissionDate)} {a.dischargeDate ? `→ ${fmtDate(a.dischargeDate)}` : '(faol)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -- FAOLIYAT TARIXI (TIMELINE) -- */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-slate-700 font-medium mb-4">
          <Activity className="w-4 h-4 text-slate-400" /> Faoliyat tarixi
        </div>
        {timelineLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Hali hech qanday faoliyat yo&apos;q</p>
        ) : (
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-100" />
            <div className="space-y-3">
              {timeline.map(ev => {
                const dotColors: Record<string, string> = {
                  blue: 'bg-blue-500', slate: 'bg-slate-400', yellow: 'bg-yellow-500',
                  green: 'bg-green-500', indigo: 'bg-indigo-500', purple: 'bg-purple-500',
                  teal: 'bg-teal-500', pink: 'bg-pink-500', orange: 'bg-orange-500',
                  cyan: 'bg-cyan-500',
                };
                const dot = dotColors[ev.color] ?? 'bg-slate-400';
                const d = new Date(ev.time);
                const timeStr = d.toLocaleString('uz-UZ', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                });
                return (
                  <div key={ev.id} className="flex gap-4 pl-1">
                    <div className="flex-shrink-0 w-6 flex items-start justify-center pt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white z-10`} />
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">{ev.title}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{timeStr}</span>
                      </div>
                      {ev.detail && (
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ev.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
