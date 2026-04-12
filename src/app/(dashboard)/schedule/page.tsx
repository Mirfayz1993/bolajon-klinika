"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Calendar,
  Pencil,
  Trash2,
} from "lucide-react";

// --- Types -------------------------------------------------------------------

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Schedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  staff: StaffMember;
}

interface Salary {
  id: string;
  month: string;
  amount: number;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  staff: StaffMember;
}

// --- Helpers -----------------------------------------------------------------

function salaryStatusBadgeClass(status: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-800";
    case "PENDING":
    default:
      return "bg-slate-100 text-slate-800";
  }
}

// --- Page --------------------------------------------------------------------

export default function SchedulePage() {
  const { t } = useLanguage();
  const { data: session } = useSession();

  const role = session?.user?.role as string | undefined;
  const isAdmin = role === "ADMIN";
  const canAddSchedule =
    role === "ADMIN" || role === "HEAD_DOCTOR" || role === "HEAD_NURSE";

  const [activeTab, setActiveTab] = useState<"schedules" | "salaries">(
    "schedules"
  );

  // -- Staff list (shared) ----------------------------------------------------
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // -- Schedules state --------------------------------------------------------
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<string>("");
  const [scheduleStaffFilter, setScheduleStaffFilter] = useState<string>("");

  // -- Add Schedule modal -----------------------------------------------------
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [schedStaffId, setSchedStaffId] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedStartTime, setSchedStartTime] = useState("");
  const [schedEndTime, setSchedEndTime] = useState("");
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedError, setSchedError] = useState<string | null>(null);

  // -- Salaries state ---------------------------------------------------------
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [salariesLoading, setSalariesLoading] = useState(false);
  const [salariesError, setSalariesError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [salaryStaffFilter, setSalaryStaffFilter] = useState<string>("");

  // -- Add Salary modal -------------------------------------------------------
  const [showAddSalaryModal, setShowAddSalaryModal] = useState(false);
  const [salStaffId, setSalStaffId] = useState("");
  const [salMonth, setSalMonth] = useState("");
  const [salAmount, setSalAmount] = useState("");
  const [salSaving, setSalSaving] = useState(false);
  const [salError, setSalError] = useState<string | null>(null);

  // -- Edit Salary modal ------------------------------------------------------
  const [showEditSalaryModal, setShowEditSalaryModal] = useState(false);
  const [editingSalary, setEditingSalary] = useState<Salary | null>(null);
  const [editSalStatus, setEditSalStatus] = useState<"PENDING" | "PAID">(
    "PENDING"
  );
  const [editSalSaving, setEditSalSaving] = useState(false);
  const [editSalError, setEditSalError] = useState<string | null>(null);

  // --- Fetch staff -----------------------------------------------------------
  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/staff");
      if (res.ok) {
        const json = await res.json();
        setStaffList(Array.isArray(json) ? json : json.data ?? []);
      }
    } catch {
      // silently fail — dropdowns will be empty
    }
  }, []);

  // --- Fetch schedules -------------------------------------------------------
  const fetchSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    setSchedulesError(null);
    try {
      const params = new URLSearchParams();
      if (dayFilter !== "") params.set("dayOfWeek", dayFilter);
      if (scheduleStaffFilter) params.set("staffId", scheduleStaffFilter);
      const res = await fetch(
        `/api/schedules${params.toString() ? "?" + params.toString() : ""}`
      );
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setSchedules(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setSchedulesError(t.common.error);
    } finally {
      setSchedulesLoading(false);
    }
  }, [dayFilter, scheduleStaffFilter, t.common.error]);

  // --- Fetch salaries --------------------------------------------------------
  const fetchSalaries = useCallback(async () => {
    setSalariesLoading(true);
    setSalariesError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "20" });
      if (monthFilter) params.set("month", monthFilter);
      if (salaryStaffFilter) params.set("staffId", salaryStaffFilter);
      const res = await fetch(`/api/salaries?${params.toString()}`);
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setSalaries(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setSalariesError(t.common.error);
    } finally {
      setSalariesLoading(false);
    }
  }, [monthFilter, salaryStaffFilter, t.common.error]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    if (activeTab === "salaries") {
      fetchSalaries();
    }
  }, [activeTab, fetchSalaries]);

  // --- Schedule handlers -----------------------------------------------------

  function openAddScheduleModal() {
    setSchedStaffId("");
    setSchedDate("");
    setSchedStartTime("");
    setSchedEndTime("");
    setSchedError(null);
    setShowAddScheduleModal(true);
  }

  async function handleAddScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schedStaffId || !schedDate || !schedStartTime || !schedEndTime) return;
    setSchedSaving(true);
    setSchedError(null);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: schedStaffId,
          date: schedDate,
          startTime: schedStartTime,
          endTime: schedEndTime,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowAddScheduleModal(false);
      fetchSchedules();
    } catch (err) {
      setSchedError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSchedSaving(false);
    }
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm(t.common.delete + "?")) return;
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t.common.error);
      fetchSchedules();
    } catch {
      setSchedulesError(t.common.error);
    }
  }

  // --- Salary handlers -------------------------------------------------------

  function openAddSalaryModal() {
    setSalStaffId("");
    setSalMonth("");
    setSalAmount("");
    setSalError(null);
    setShowAddSalaryModal(true);
  }

  async function handleAddSalarySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!salStaffId || !salMonth || !salAmount) return;
    setSalSaving(true);
    setSalError(null);
    try {
      const res = await fetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: salStaffId,
          month: salMonth,
          amount: Number(salAmount),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowAddSalaryModal(false);
      fetchSalaries();
    } catch (err) {
      setSalError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSalSaving(false);
    }
  }

  function openEditSalaryModal(salary: Salary) {
    setEditingSalary(salary);
    setEditSalStatus(salary.status);
    setEditSalError(null);
    setShowEditSalaryModal(true);
  }

  async function handleEditSalarySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSalary) return;
    setEditSalSaving(true);
    setEditSalError(null);
    try {
      const res = await fetch(`/api/salaries/${editingSalary.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editSalStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowEditSalaryModal(false);
      fetchSalaries();
    } catch (err) {
      setEditSalError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setEditSalSaving(false);
    }
  }

  // --- Render ----------------------------------------------------------------

  const days: Record<string, string> = t.schedule.days as unknown as Record<
    string,
    string
  >;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" />
          {t.schedule.title}
        </h1>

        {activeTab === "schedules" && canAddSchedule && (
          <button
            onClick={openAddScheduleModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t.schedule.addSchedule}
          </button>
        )}
        {activeTab === "salaries" && isAdmin && (
          <button
            onClick={openAddSalaryModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t.schedule.addSalary}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("schedules")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "schedules"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.schedule.schedules}
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab("salaries")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "salaries"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.schedule.salaries}
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1: Jadvallar
      ══════════════════════════════════════════════════════ */}
      {activeTab === "schedules" && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            {/* Day of week filter */}
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t.common.all}</option>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={String(d)}>
                  {days[String(d)]}
                </option>
              ))}
            </select>

            {/* Staff filter */}
            <select
              value={scheduleStaffFilter}
              onChange={(e) => setScheduleStaffFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t.schedule.selectEmployee}</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lastName} {s.firstName}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {schedulesError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {schedulesError}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.schedule.employee}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.staff.role}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.schedule.dayOfWeek}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.schedule.startTime}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.schedule.endTime}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedulesLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : schedules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-slate-400"
                      >
                        {t.schedule.noSchedules}
                      </td>
                    </tr>
                  ) : (
                    schedules.map((sch) => (
                      <tr
                        key={sch.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {sch.staff.lastName} {sch.staff.firstName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {(t.roles as Record<string, string>)[sch.staff.role] ??
                            sch.staff.role}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {days[String(sch.dayOfWeek)] ?? sch.dayOfWeek}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {sch.startTime}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {sch.endTime}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canAddSchedule && (
                              <button
                                onClick={() => handleDeleteSchedule(sch.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title={t.common.delete}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2: Maoshlar (faqat ADMIN)
      ══════════════════════════════════════════════════════ */}
      {activeTab === "salaries" && isAdmin && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            {/* Month filter */}
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            {/* Staff filter */}
            <select
              value={salaryStaffFilter}
              onChange={(e) => setSalaryStaffFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t.schedule.selectEmployee}</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lastName} {s.firstName}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {salariesError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {salariesError}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.schedule.employee}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.schedule.month}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.schedule.amount}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.common.status}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.schedule.paidAt}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {salariesLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : salaries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-slate-400"
                      >
                        {t.schedule.noSalaries}
                      </td>
                    </tr>
                  ) : (
                    salaries.map((sal) => (
                      <tr
                        key={sal.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {sal.staff.lastName} {sal.staff.firstName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {sal.month}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {sal.amount.toLocaleString()} {t.common.sum}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${salaryStatusBadgeClass(sal.status)}`}
                          >
                            {(t.schedule.status as Record<string, string>)[
                              sal.status
                            ] ?? sal.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {sal.paidAt
                            ? new Date(sal.paidAt).toLocaleDateString("uz-UZ")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditSalaryModal(sal)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title={t.common.edit}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Jadval qo'shish
      ═══════════════════════════════════════════════════════ */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {t.schedule.addSchedule}
              </h2>
              <button
                onClick={() => setShowAddScheduleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleAddScheduleSubmit}
              className="p-6 space-y-4"
            >
              {schedError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {schedError}
                </div>
              )}

              {/* Xodim */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.schedule.employee}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={schedStaffId}
                  onChange={(e) => setSchedStaffId(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t.schedule.selectEmployee}</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.lastName} {s.firstName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sana */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.schedule.date}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Boshlanish vaqti */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.schedule.startTime}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={schedStartTime}
                  onChange={(e) => setSchedStartTime(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Tugash vaqti */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.schedule.endTime}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={schedEndTime}
                  onChange={(e) => setSchedEndTime(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddScheduleModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={schedSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {schedSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Maosh qo'shish
      ═══════════════════════════════════════════════════════ */}
      {showAddSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {t.schedule.addSalary}
              </h2>
              <button
                onClick={() => setShowAddSalaryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSalarySubmit} className="p-6 space-y-4">
              {salError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {salError}
                </div>
              )}

              {/* Xodim */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.schedule.employee}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={salStaffId}
                  onChange={(e) => setSalStaffId(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t.schedule.selectEmployee}</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.lastName} {s.firstName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Oy */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.schedule.month}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="month"
                  value={salMonth}
                  onChange={(e) => setSalMonth(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Miqdor */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.schedule.amount}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={salAmount}
                  onChange={(e) => setSalAmount(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSalaryModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={salSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {salSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Maosh tahrirlash (status o'zgartirish)
      ═══════════════════════════════════════════════════════ */}
      {showEditSalaryModal && editingSalary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {t.common.edit}
              </h2>
              <button
                onClick={() => setShowEditSalaryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSalarySubmit} className="p-6 space-y-4">
              {editSalError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {editSalError}
                </div>
              )}

              {/* Read-only info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1 text-sm">
                <p>
                  <span className="text-slate-500">
                    {t.schedule.employee}:{" "}
                  </span>
                  <span className="font-medium text-slate-800">
                    {editingSalary.staff.lastName}{" "}
                    {editingSalary.staff.firstName}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">{t.schedule.month}: </span>
                  <span className="font-medium text-slate-800">
                    {editingSalary.month}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">
                    {t.schedule.amount}:{" "}
                  </span>
                  <span className="font-medium text-slate-800">
                    {editingSalary.amount.toLocaleString()} {t.common.sum}
                  </span>
                </p>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.common.status}
                </label>
                <select
                  value={editSalStatus}
                  onChange={(e) =>
                    setEditSalStatus(e.target.value as "PENDING" | "PAID")
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="PENDING">
                    {(t.schedule.status as Record<string, string>)["PENDING"]}
                  </option>
                  <option value="PAID">
                    {(t.schedule.status as Record<string, string>)["PAID"]}
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditSalaryModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={editSalSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {editSalSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
