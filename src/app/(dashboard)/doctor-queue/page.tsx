'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  PhoneCall, CheckCircle2, AlertTriangle, Clock, User,
  Loader2, ChevronDown, UserCheck, Star, SkipForward
} from 'lucide-react';

interface Patient { id: string; firstName: string; lastName: string; fatherName: string; phone: string; birthDate: string; }
interface Doctor { id: string; name: string; }
interface Appointment { id: string; patient: Patient; doctor: Doctor; }
interface QueueItem {
  id: string; queueNumber: number; status: 'WAITING' | 'CALLED';
  isUrgent: boolean; isPriority: boolean;
  calledAt: string | null; createdAt: string;
  appointment: Appointment;
}
interface DoneItem {
  id: string; queueNumber: number; doneAt: string | null;
  appointment: { id: string; patient: { id: string; firstName: string; lastName: string } };
}

const ROLE_LABELS: Record<string, string> = {
  DOCTOR: 'Shifokor', HEAD_DOCTOR: 'Bosh shifokor',
  ADMIN: 'Admin', RECEPTIONIST: 'Qabulxona',
};

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}
function age(birthDate: string) {
  return new Date().getFullYear() - new Date(birthDate).getFullYear();
}

export default function DoctorQueuePage() {
  const { data: session } = useSession();
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [done, setDone] = useState<DoneItem[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selDoctor, setSelDoctor] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDoctor = ['DOCTOR', 'HEAD_DOCTOR'].includes(session?.user?.role ?? '');
  const canManage = ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'].includes(session?.user?.role ?? '');

  const doctorId = isDoctor ? session?.user?.id : selDoctor;

  const load = useCallback(async () => {
    if (!doctorId) { setLoading(false); return; }
    const res = await fetch(`/api/doctor-queue?doctorId=${doctorId}`);
    if (res.ok) {
      const d = await res.json();
      setQueues(d.queues);
      setDone(d.done);
      if (!isDoctor) setDoctors(d.doctors);
    }
    setLoading(false);
  }, [doctorId, isDoctor]);

  // Doctors ro'yxatini yuklash (admin/receptionist uchun)
  useEffect(() => {
    if (!isDoctor) {
      fetch('/api/doctor-queue?doctorId=_').then(r => r.json()).then(d => {
        setDoctors(d.doctors ?? []);
      }).catch(() => null);
    }
  }, [isDoctor]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const action = async (queueId: string, act: 'call' | 'done' | 'urgent') => {
    setBusy(queueId + act);
    await fetch(`/api/doctor-queue/${queueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act }),
    });
    setBusy(null);
    load();
  };

  const called = queues.find(q => q.status === 'CALLED');
  const waiting = queues.filter(q => q.status === 'WAITING');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-blue-600" /> Doktor navbati
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Bugungi bemorlar navbati</p>
        </div>

        {/* Admin/Receptionist uchun doktor tanlash */}
        {!isDoctor && (
          <div className="flex items-center gap-2">
            <ChevronDown className="w-4 h-4 text-slate-400" />
            <select
              value={selDoctor}
              onChange={e => setSelDoctor(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Doktor tanlang...</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {!doctorId ? (
        <div className="text-center py-16 text-slate-400">Doktor tanlanmagan</div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : (
        <>
          {/* Statistika */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{waiting.length}</p>
              <p className="text-xs text-blue-600 mt-1">Kutmoqda</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{done.length}</p>
              <p className="text-xs text-green-600 mt-1">Qabul qilindi</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{queues.filter(q => q.isUrgent).length}</p>
              <p className="text-xs text-amber-600 mt-1">Shoshilinch</p>
            </div>
          </div>

          {/* Hozir qabul qilinayotgan */}
          {called && (
            <div className="bg-blue-600 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-blue-200 text-xs font-medium mb-1 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> HOZIR QABUL DA
                  </p>
                  <p className="text-xl font-bold">
                    {called.appointment.patient.lastName} {called.appointment.patient.firstName}
                  </p>
                  <p className="text-blue-200 text-sm mt-0.5">
                    {called.appointment.patient.fatherName} • {age(called.appointment.patient.birthDate)} yosh •
                    Navbat #{called.queueNumber}
                  </p>
                  {called.calledAt && (
                    <p className="text-blue-300 text-xs mt-1">Chaqirildi: {fmtTime(called.calledAt)}</p>
                  )}
                </div>
                <button
                  onClick={() => action(called.id, 'done')}
                  disabled={busy === called.id + 'done'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 font-semibold text-sm rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {busy === called.id + 'done' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Tugatish
                </button>
              </div>
            </div>
          )}

          {/* Kutish navbati */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> Navbat ro&apos;yxati
              </span>
              <span className="text-xs text-slate-400">{waiting.length} ta kutmoqda</span>
            </div>

            {waiting.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">Navbatda hech kim yo&apos;q</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {waiting.map((q, idx) => (
                  <div key={q.id} className={`flex items-center justify-between px-5 py-4 transition-colors
                    ${q.isUrgent ? 'bg-red-50 hover:bg-red-50/80' : q.isPriority ? 'bg-amber-50 hover:bg-amber-50/80' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Navbat raqami */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0
                        ${q.isUrgent ? 'bg-red-100 text-red-700' : q.isPriority ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {q.isUrgent ? '!' : q.isPriority ? '★' : q.queueNumber}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 text-sm">
                            {q.appointment.patient.lastName} {q.appointment.patient.firstName}
                          </p>
                          {q.isUrgent && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Shoshilinch
                            </span>
                          )}
                          {q.isPriority && !q.isUrgent && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium flex items-center gap-1">
                              <Star className="w-3 h-3" /> Oldindan to&apos;lagan
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {q.appointment.patient.fatherName} • {age(q.appointment.patient.birthDate)} yosh •
                          Navbat #{q.queueNumber} • {fmtTime(q.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Amallar */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {/* Shoshilinch toggle (admin/receptionist) */}
                      {canManage && (
                        <button
                          onClick={() => action(q.id, 'urgent')}
                          disabled={busy === q.id + 'urgent'}
                          title={q.isUrgent ? 'Shoshilinchni bekor qilish' : 'Shoshilinch belgilash'}
                          className={`p-2 rounded-lg transition-colors ${q.isUrgent ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-slate-300 hover:bg-slate-100 hover:text-amber-500'}`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      )}

                      {/* Navbatsiz chaqirish */}
                      {idx > 0 && (isDoctor || canManage) && (
                        <button
                          onClick={() => action(q.id, 'call')}
                          disabled={!!busy}
                          title="Navbatsiz chaqirish"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-purple-100 hover:text-purple-700 transition-colors disabled:opacity-50"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                          Navbatsiz
                        </button>
                      )}

                      {/* Chaqirish (navbatdagi birinchi) */}
                      {idx === 0 && (isDoctor || canManage) && (
                        <button
                          onClick={() => action(q.id, 'call')}
                          disabled={!!busy}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {busy === q.id + 'call' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                          Chaqirish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bugun qabul qilinganlar */}
          {done.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <span className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Bugun qabul qilinganlar ({done.length})
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {done.map(d => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-6">#{d.queueNumber}</span>
                      <p className="text-sm text-slate-600">{d.appointment.patient.lastName} {d.appointment.patient.firstName}</p>
                    </div>
                    {d.doneAt && <span className="text-xs text-slate-400">{fmtTime(d.doneAt)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
