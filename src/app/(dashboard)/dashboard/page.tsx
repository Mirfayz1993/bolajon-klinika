'use client';

import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Users,
  CalendarDays,
  Clock,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';

interface StatCard {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface UpcomingRow {
  patient: string;
  doctor: string;
  time: string;
  status: string;
  statusClass: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();

  const stats: StatCard[] = [
    {
      title: t.dashboard.todayPatients,
      value: '48',
      change: '+12%',
      positive: true,
      icon: <Users size={22} />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: t.dashboard.todayAppointments,
      value: '35',
      change: '+5%',
      positive: true,
      icon: <CalendarDays size={22} />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: t.dashboard.waiting,
      value: '7',
      change: '-3%',
      positive: false,
      icon: <Clock size={22} />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: t.dashboard.todayIncome,
      value: '2 450 000',
      change: '+18%',
      positive: true,
      icon: <TrendingUp size={22} />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  const upcomingRows: UpcomingRow[] = [
    {
      patient: 'Aliyev Bobur',
      doctor: 'Dr. Karimov',
      time: '09:00',
      status: t.appointments.status.SCHEDULED,
      statusClass: 'bg-green-100 text-green-800',
    },
    {
      patient: 'Toshmatova Nilufar',
      doctor: 'Dr. Yusupova',
      time: '09:30',
      status: t.appointments.status.IN_QUEUE,
      statusClass: 'bg-blue-100 text-blue-800',
    },
    {
      patient: 'Rahimov Sardor',
      doctor: 'Dr. Karimov',
      time: '10:00',
      status: t.appointments.status.IN_PROGRESS,
      statusClass: 'bg-yellow-100 text-yellow-800',
    },
    {
      patient: 'Normatova Zulfiya',
      doctor: 'Dr. Hasanov',
      time: '10:30',
      status: t.appointments.status.SCHEDULED,
      statusClass: 'bg-green-100 text-green-800',
    },
    {
      patient: 'Qodirov Mansur',
      doctor: 'Dr. Yusupova',
      time: '11:00',
      status: t.appointments.status.SCHEDULED,
      statusClass: 'bg-green-100 text-green-800',
    },
  ];

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
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4"
          >
            <div className={`${card.bgColor} ${card.color} p-2.5 rounded-xl flex-shrink-0`}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 truncate">{card.title}</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
                {card.value}
              </p>
              <div
                className={`inline-flex items-center gap-0.5 text-xs font-medium mt-1 ${
                  card.positive ? 'text-green-600' : 'text-red-500'
                }`}
              >
                <ArrowUpRight
                  size={13}
                  className={card.positive ? '' : 'rotate-180'}
                />
                {card.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming appointments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            {t.dashboard.upcomingAppointments}
          </h3>
          <span className="text-xs text-blue-600 font-medium cursor-pointer hover:underline">
            {t.common.all}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-6 py-3 font-medium">{t.patients.title}</th>
                <th className="px-6 py-3 font-medium">{t.appointments.doctor}</th>
                <th className="px-6 py-3 font-medium">{t.common.time}</th>
                <th className="px-6 py-3 font-medium">{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {upcomingRows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-3.5 font-medium text-slate-800">{row.patient}</td>
                  <td className="px-6 py-3.5 text-slate-600">{row.doctor}</td>
                  <td className="px-6 py-3.5 text-slate-600">{row.time}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.statusClass}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
