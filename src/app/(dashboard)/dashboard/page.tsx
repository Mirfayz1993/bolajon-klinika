'use client';

import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, CalendarDays, Clock, TrendingUp,
  BedDouble, Stethoscope, Loader2, AlertCircle,
} from 'lucide-react';

interface TodayStats {
  todayPatients: number;
  todayAppointments: number;
  waitingCount: number;
  todayIncome: number;
}

interface QueueRow {
  id: string;
  patient: { firstName: string; lastName: string };
  doctor: { firstName: string; lastName: string } | null;
  dateTime: string;
  status: string;
  type: string;
}

interface ActiveAdmission {
  id: string;
  admissionDate: string;
  notes: string | null;
  patient: { id: string; firstName: string; lastName: string };
  bed: { bedNumber: string; room: { roomNumber: string; floor: number } };
}

interface AmbulatoryRow {
  id: string;
  patient: { id: string; firstName: string; lastName: string };
  room: { roomNumber: string };
  bed: { bedNumber: string };
  admittedAt: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Rejalashtirilgan',
  IN_QUEUE: 'Navbatda',
  IN_PROGRESS: 'Jarayonda',
  COMPLETED: 'Tugadi',
  CANCELLED: 'Bekor',
};

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: 'bg-green-100 text-green-800',
  IN_QUEUE: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n);
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const router = useRouter();

  const [stats, setStats] = useState<TodayStats | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [inpatients, setInpatients] = useState<ActiveAdmission[]>([]);
  const [ambulatory, setAmbulatory] = useState<AmbulatoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);

      const [statsRes, queueRes, inpRes, ambRes] = await Promise.all([
        fetch(`/api/reports/financial?from=${today}&to=${today}`),
        fetch(`/api/appointments?date=${today}&limit=20`),
        fetch('/api/admissions?status=ACTIVE&admissionType=INPATIENT&limit=20'),
        fetch('/api/ambulatory?status=ACTIVE&limit=20'),
      ]);

      // Stats
      let todayIncome = 0;
      let todayAppointments = 0;
      let waitingCount = 0;
      if (statsRes.ok) {
        const s = await statsRes.json();
        todayIncome = s.totalRevenue ?? 0;
      }

      // Queue
      let queueRows: QueueRow[] = [];
      if (queueRes.ok) {
        const q = await queueRes.json();
        queueRows = (q.data ?? q) as QueueRow[];
        todayAppointments = queueRows.length;
        waitingCount = queueRows.filter((r: QueueRow) => r.status === 'IN_QUEUE' || r.status === 'SCHEDULED').length;
      }
      setQueue(queueRows.slice(0, 8));

      // Inpatients
      let inpRows: ActiveAdmission[] = [];
      if (inpRes.ok) {
        const inp = await inpRes.json();
        inpRows = (inp.data ?? inp) as ActiveAdmission[];
      }
      setInpatients(inpRows);

      // Ambulatory
      let ambRows: AmbulatoryRow[] = [];
      if (ambRes.ok) {
        const amb = await ambRes.json();
        ambRows = (amb.data ?? amb) as AmbulatoryRow[];
      }
      setAmbulatory(ambRows);

      // Total active patients (unique)
      const totalPatients = new Set([
        ...inpRows.map(r => r.patient.id),
        ...ambRows.map(r => r.patient.id),
        ...queueRows.map((r: QueueRow) => r.id),
      ]).size;

      setStats({
        todayPatients: totalPatients || todayAppointments,
        todayAppointments,
        waitingCount,
        todayIncome,
      });
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const statCards = stats ? [
    {
      title: t.dashboard.todayPatients,
      value: String(stats.todayPatients),
      icon: <Users size={22} />,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: t.dashboard.todayAppointments,
      value: String(stats.todayAppointments),
      icon: <CalendarDays size={22} />,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: t.dashboard.waiting,
      value: String(stats.waitingCount),
      icon: <Clock size={22} />,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      title: t.dashboard.todayIncome,
      value: formatMoney(stats.todayIncome),
      icon: <TrendingUp size={22} />,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {t.auth.welcome},{' '}
          <span className="text-blue-600">{session?.user?.name ?? '—'}</span>
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('uz-UZ', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-24 animate-pulse" />
        )) : statCards.map(card => (
          <div key={card.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
            <div className={`${card.bg} ${card.color} p-2.5 rounded-xl flex-shrink-0`}>{card.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 truncate">{card.title}</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bugungi navbat */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              Bugungi qabullar
            </h3>
            <button onClick={() => router.push('/appointments')} className="text-xs text-blue-600 font-medium hover:underline">
              Barchasi
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : queue.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">Bugun qabul yo&apos;q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-6 py-3 font-medium">Bemor</th>
                    <th className="px-6 py-3 font-medium">Shifokor</th>
                    <th className="px-6 py-3 font-medium">Vaqt</th>
                    <th className="px-6 py-3 font-medium">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(row => (
                    <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-800">
                        {row.patient.lastName} {row.patient.firstName}
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {row.doctor ? `${row.doctor.lastName} ${row.doctor.firstName}` : '—'}
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {new Date(row.dateTime).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[row.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Statsionar — faol bemorlar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-purple-500" />
              Statsionar — faol ({inpatients.length} ta)
            </h3>
            <button onClick={() => router.push('/admissions')} className="text-xs text-blue-600 font-medium hover:underline">
              Barchasi
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : inpatients.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">Faol statsionar bemor yo&apos;q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-6 py-3 font-medium">Bemor</th>
                    <th className="px-6 py-3 font-medium">Xona / To&apos;shak</th>
                    <th className="px-6 py-3 font-medium">Yotqizilgan</th>
                  </tr>
                </thead>
                <tbody>
                  {inpatients.slice(0, 8).map(adm => (
                    <tr
                      key={adm.id}
                      onClick={() => router.push(`/patients/${adm.patient.id}`)}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3 font-medium text-slate-800">
                        {adm.patient.lastName} {adm.patient.firstName}
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {adm.bed.room.roomNumber} / {adm.bed.bedNumber}
                      </td>
                      <td className="px-6 py-3 text-slate-500 text-xs">
                        {new Date(adm.admissionDate).toLocaleDateString('uz-UZ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Ambulator — faol bemorlar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-teal-500" />
            Ambulator — faol ({ambulatory.length} ta)
          </h3>
          <button onClick={() => router.push('/ambulatory')} className="text-xs text-blue-600 font-medium hover:underline">
            Barchasi
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : ambulatory.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-10">Faol ambulator bemor yo&apos;q</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-3 font-medium">Bemor</th>
                  <th className="px-6 py-3 font-medium">Xona / To&apos;shak</th>
                  <th className="px-6 py-3 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody>
                {ambulatory.slice(0, 8).map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => router.push(`/patients/${row.patient.id}`)}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {row.patient.lastName} {row.patient.firstName}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {row.room?.roomNumber ?? '—'} / {row.bed?.bedNumber ?? '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                        Muolajada
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
