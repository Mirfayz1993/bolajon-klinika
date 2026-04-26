"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  DollarSign,
  Clock,
  CreditCard,
  Users,
  UserPlus,
  CalendarDays,
  BedDouble,
  FlaskConical,
  CheckCircle,
  UserCog,
  Activity,
  Wallet,
  Calendar,
} from "lucide-react";

// --- Types --------------------------------------------------------------------

interface FinancialReport {
  totalRevenue: number;
  totalPending: number;
  paymentCount: number;
  byCategory: Record<string, number>;
  byMethod: Record<string, number>;
  byDay: { date: string; total: number }[];
}

interface PatientsReport {
  totalPatients: number;
  newPatients: number;
  totalAppointments: number;
  totalAdmissions: number;
  activeAdmissions: number;
}

interface LabReport {
  totalTests: number;
  completionRate: number;
  byStatus: { status: string; count: number }[];
  byType: { name: string; count: number; revenue: number }[];
}

interface StaffReport {
  totalStaff: number;
  activeStaff: number;
  totalSalaryPaid: number;
  scheduleCount: number;
  byRole: { role: string; count: number }[];
}

// --- Helpers ------------------------------------------------------------------

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("uz-UZ").format(amount);
}

// --- StatCard -----------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "green" | "yellow" | "blue" | "red" | "indigo" | "purple";
  suffix?: string;
}

const colorMap: Record<
  StatCardProps["color"],
  { bg: string; icon: string; value: string }
> = {
  green: {
    bg: "bg-green-50 border-green-100",
    icon: "text-green-600",
    value: "text-green-700",
  },
  yellow: {
    bg: "bg-yellow-50 border-yellow-100",
    icon: "text-yellow-600",
    value: "text-yellow-700",
  },
  blue: {
    bg: "bg-blue-50 border-blue-100",
    icon: "text-blue-600",
    value: "text-blue-700",
  },
  red: {
    bg: "bg-red-50 border-red-100",
    icon: "text-red-600",
    value: "text-red-700",
  },
  indigo: {
    bg: "bg-indigo-50 border-indigo-100",
    icon: "text-indigo-600",
    value: "text-indigo-700",
  },
  purple: {
    bg: "bg-purple-50 border-purple-100",
    icon: "text-purple-600",
    value: "text-purple-700",
  },
};

function StatCard({ label, value, icon, color, suffix }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${c.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        <span className={c.icon}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${c.value}`}>
        {value}
        {suffix && (
          <span className="text-sm font-normal text-slate-400 ml-1">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// --- DateFilter ---------------------------------------------------------------

interface DateFilterProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: () => void;
  applyLabel: string;
  fromLabel: string;
  toLabel: string;
}

function DateFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onApply,
  applyLabel,
  fromLabel,
  toLabel,
}: DateFilterProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-wrap items-end gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {fromLabel}
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {toLabel}
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>
      <button
        onClick={onApply}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        {applyLabel}
      </button>
    </div>
  );
}

// --- SimpleTable --------------------------------------------------------------

interface SimpleTableProps {
  headers: string[];
  rows: (string | number)[][];
  noDataLabel: string;
}

function SimpleTable({ headers, rows, noDataLabel }: SimpleTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-left">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-8 text-center text-slate-400"
              >
                {noDataLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- LoadingSpinner -----------------------------------------------------------

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-16">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

// --- ErrorMessage -------------------------------------------------------------

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">
      {message}
    </div>
  );
}

// --- FinancialTab -------------------------------------------------------------

function FinancialTab() {
  const { t } = useLanguage();
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);
  const [data, setData] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/reports/financial?from=${appliedFrom}&to=${appliedTo}`
      );
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setData(json);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, t.common.error]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApply = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  return (
    <div>
      <DateFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={handleApply}
        applyLabel={t.reports.apply}
        fromLabel={t.reports.from}
        toLabel={t.reports.to}
      />

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : data ? (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={t.reports.totalRevenue}
              value={formatMoney(data.totalRevenue)}
              suffix={t.common.sum}
              icon={<DollarSign size={20} />}
              color="green"
            />
            <StatCard
              label={t.reports.totalPending}
              value={formatMoney(data.totalPending)}
              suffix={t.common.sum}
              icon={<Clock size={20} />}
              color="yellow"
            />
            <StatCard
              label={t.reports.paymentCount}
              value={data.paymentCount}
              icon={<CreditCard size={20} />}
              color="blue"
            />
          </div>

          {/* By category */}
          <div>
            <h3 className="text-base font-semibold text-slate-700 mb-3">
              {t.reports.byCategory}
            </h3>
            <SimpleTable
              headers={[t.payments.category, t.common.total + " (" + t.common.sum + ")"]}
              rows={Object.entries(data.byCategory).map(([category, total]) => [
                ({
                  CHECKUP: "Qabulxona / Ko'rik",
                  LAB_TEST: "Laboratoriya tahlili",
                  SPEECH_THERAPY: "Logoped",
                  MASSAGE: "Massaj",
                  TREATMENT: "Muolaja",
                  INPATIENT: "Statsionar",
                  AMBULATORY: "Ambulator",
                  MEDICINE: "Dori",
                  OTHER: "Boshqa",
                } as Record<string, string>)[category] ?? category,
                formatMoney(total),
              ])}
              noDataLabel={t.reports.noData}
            />
          </div>

          {/* By method */}
          <div>
            <h3 className="text-base font-semibold text-slate-700 mb-3">
              {t.reports.byMethod}
            </h3>
            <SimpleTable
              headers={[t.payments.method, t.common.total + " (" + t.common.sum + ")"]}
              rows={Object.entries(data.byMethod).map(([method, total]) => [
                ({
                  CASH: "Naqd pul",
                  CARD: "Karta",
                  BANK_TRANSFER: "Bank o'tkazma",
                  CLICK: "Click",
                  PAYME: "Payme",
                } as Record<string, string>)[method] ?? method,
                formatMoney(total),
              ])}
              noDataLabel={t.reports.noData}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- PatientsTab --------------------------------------------------------------

function PatientsTab() {
  const { t } = useLanguage();
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);
  const [data, setData] = useState<PatientsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/reports/patients?from=${appliedFrom}&to=${appliedTo}`
      );
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setData(json);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, t.common.error]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApply = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  return (
    <div>
      <DateFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={handleApply}
        applyLabel={t.reports.apply}
        fromLabel={t.reports.from}
        toLabel={t.reports.to}
      />

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t.reports.totalPatients}
              value={data.totalPatients}
              icon={<Users size={20} />}
              color="blue"
            />
            <StatCard
              label={t.reports.newPatients}
              value={data.newPatients}
              icon={<UserPlus size={20} />}
              color="green"
            />
            <StatCard
              label={t.reports.totalAppointments}
              value={data.totalAppointments}
              icon={<CalendarDays size={20} />}
              color="indigo"
            />
            <StatCard
              label={t.reports.totalAdmissions}
              value={data.totalAdmissions}
              icon={<BedDouble size={20} />}
              color="purple"
            />
          </div>

          {/* Aktiv yotganlar badge */}
          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <BedDouble size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">
                {t.reports.activeAdmissions}
              </p>
              <p className="text-2xl font-bold text-red-600">
                {data.activeAdmissions}
              </p>
            </div>
            <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
              {t.admissions.active}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- LabTab -------------------------------------------------------------------

function LabTab() {
  const { t } = useLanguage();
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);
  const [data, setData] = useState<LabReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/reports/lab?from=${appliedFrom}&to=${appliedTo}`
      );
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setData(json);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, t.common.error]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApply = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  return (
    <div>
      <DateFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={handleApply}
        applyLabel={t.reports.apply}
        fromLabel={t.reports.from}
        toLabel={t.reports.to}
      />

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : data ? (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={t.reports.totalTests}
              value={data.totalTests}
              icon={<FlaskConical size={20} />}
              color="blue"
            />
            <StatCard
              label={t.reports.completionRate}
              value={`${data.completionRate.toFixed(1)}%`}
              icon={<CheckCircle size={20} />}
              color="green"
            />
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-3">
                {t.common.status}
              </p>
              <div className="space-y-2">
                {data.byStatus.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-600">{s.status}</span>
                    <span className="font-semibold text-slate-800">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* By type table */}
          <div>
            <h3 className="text-base font-semibold text-slate-700 mb-3">
              {t.lab.testTypes}
            </h3>
            <SimpleTable
              headers={[
                t.lab.testType,
                t.lab.tests,
                t.common.total + " (" + t.common.sum + ")",
              ]}
              rows={data.byType.map((r) => [
                r.name,
                r.count,
                formatMoney(r.revenue),
              ])}
              noDataLabel={t.reports.noData}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- StaffTab -----------------------------------------------------------------

function StaffTab() {
  const { t } = useLanguage();
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);
  const [data, setData] = useState<StaffReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ROLE_LABELS = t.roles as Record<string, string>;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/reports/staff?from=${appliedFrom}&to=${appliedTo}`
      );
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setData(json);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, t.common.error]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApply = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  return (
    <div>
      <DateFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={handleApply}
        applyLabel={t.reports.apply}
        fromLabel={t.reports.from}
        toLabel={t.reports.to}
      />

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : data ? (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t.reports.totalStaff}
              value={data.totalStaff}
              icon={<Users size={20} />}
              color="blue"
            />
            <StatCard
              label={t.reports.activeStaff}
              value={data.activeStaff}
              icon={<Activity size={20} />}
              color="green"
            />
            <StatCard
              label={t.reports.totalSalaryPaid}
              value={formatMoney(data.totalSalaryPaid)}
              suffix={t.common.sum}
              icon={<Wallet size={20} />}
              color="yellow"
            />
            <StatCard
              label={t.reports.scheduleCount}
              value={data.scheduleCount}
              icon={<Calendar size={20} />}
              color="indigo"
            />
          </div>

          {/* By role table */}
          <div>
            <h3 className="text-base font-semibold text-slate-700 mb-3">
              {t.staff.role}
            </h3>
            <SimpleTable
              headers={[t.staff.role, t.staff.employeeCount]}
              rows={data.byRole.map((r) => [
                ROLE_LABELS[r.role] ?? r.role,
                r.count,
              ])}
              noDataLabel={t.reports.noData}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- Main Page ----------------------------------------------------------------

type TabKey = "financial" | "patients" | "lab" | "staff";

export default function ReportsPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<TabKey>("financial");

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      key: "financial",
      label: t.reports.financial,
      icon: <DollarSign size={16} />,
    },
    {
      key: "patients",
      label: t.reports.patients,
      icon: <Users size={16} />,
    },
    {
      key: "lab",
      label: t.reports.lab,
      icon: <FlaskConical size={16} />,
    },
    ...(isAdmin
      ? [
          {
            key: "staff" as TabKey,
            label: t.reports.staff,
            icon: <UserCog size={16} />,
          },
        ]
      : []),
  ];

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t.reports.title}</h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-white rounded-xl shadow-sm border border-slate-100 p-1 mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "financial" && <FinancialTab />}
        {activeTab === "patients" && <PatientsTab />}
        {activeTab === "lab" && <LabTab />}
        {activeTab === "staff" && isAdmin && <StaffTab />}
      </div>
    </div>
  );
}
