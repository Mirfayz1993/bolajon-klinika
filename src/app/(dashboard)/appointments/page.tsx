'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Search,
  Calendar,
  Trash2,
} from 'lucide-react';

// --- Types -------------------------------------------------------------------

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  type: string;
  dateTime: string;
  status: string;
  roomId?: string | null;
  notes?: string | null;
  patient: { id: string; firstName: string; lastName: string };
  doctor: { id: string; name: string; role: string };
  queue?: { queueNumber: number; status: string } | null;
  createdAt: string;
}

type AppointmentStatus =
  | 'SCHEDULED'
  | 'IN_QUEUE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

type AppointmentType =
  | 'CHECKUP'
  | 'FOLLOW_UP'
  | 'SPEECH_THERAPY'
  | 'MASSAGE'
  | 'LAB_TEST'
  | 'PHYSIOTHERAPY';

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
}

interface DoctorOption {
  id: string;
  name: string;
  role: string;
}

interface NewAppointmentForm {
  patientId: string;
  doctorId: string;
  type: AppointmentType | '';
  notes: string;
}

// --- Constants ---------------------------------------------------------------

const ALL_STATUSES: AppointmentStatus[] = [
  'SCHEDULED',
  'IN_QUEUE',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

const ALL_TYPES: AppointmentType[] = [
  'CHECKUP',
  'FOLLOW_UP',
  'SPEECH_THERAPY',
  'MASSAGE',
  'LAB_TEST',
  'PHYSIOTHERAPY',
];


const STATUS_BADGE: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-800',
  IN_QUEUE: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-orange-100 text-orange-800',
};

const DOCTOR_ROLES = ['DOCTOR', 'HEAD_DOCTOR'];

const today = new Date().toISOString().split('T')[0];

const emptyForm: NewAppointmentForm = {
  patientId: '',
  doctorId: '',
  type: '',
  notes: '',
};

// --- Component ---------------------------------------------------------------

export default function AppointmentsPage() {
  const { t } = useLanguage();
  const TYPE_LABELS = t.appointmentTypes as Record<string, string>;

  // List state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState(today);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Doctors for filter/form
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewAppointmentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Patient search (modal)
  const [patientSearch, setPatientSearch] = useState('');
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patientDropdownRef = useRef<HTMLDivElement>(null);

  // -- Fetch appointments ----------------------------------------------------

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      if (doctorFilter) params.set('doctorId', doctorFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/appointments?${params.toString()}`);
      if (!res.ok) throw new Error(t.common.error);
      const json: { data: Appointment[] } = await res.json();
      setAppointments(json.data ?? []);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, doctorFilter, statusFilter, typeFilter, t.common.error]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // -- Fetch doctors (once) -------------------------------------------------

  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await fetch('/api/staff?role=DOCTOR');
        if (!res.ok) return;
        const data: DoctorOption[] = await res.json();
        setDoctors(data);
      } catch {
        // non-critical
      }
    }
    loadDoctors();
  }, []);

  // -- Patient search with debounce ------------------------------------------

  useEffect(() => {
    if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    if (!patientSearch.trim()) {
      setPatientOptions([]);
      setShowPatientDropdown(false);
      return;
    }
    patientSearchTimer.current = setTimeout(async () => {
      setPatientSearchLoading(true);
      try {
        const res = await fetch(
          `/api/patients?search=${encodeURIComponent(patientSearch)}&limit=20`
        );
        if (!res.ok) return;
        const json: { data: PatientOption[] } = await res.json();
        setPatientOptions(json.data);
        setShowPatientDropdown(true);
      } catch {
        // ignore
      } finally {
        setPatientSearchLoading(false);
      }
    }, 350);
    return () => {
      if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    };
  }, [patientSearch]);

  // Close patient dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        patientDropdownRef.current &&
        !patientDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // -- Status change ---------------------------------------------------------

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    try {
      const res = await fetch(`/api/appointments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch {
      setError(t.common.error);
    }
  };

  // -- Delete (cancel) appointment -------------------------------------------

  const handleDelete = async (id: string) => {
    if (!confirm(t.appointments.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchAppointments();
    } catch {
      setError(t.common.error);
    }
  };

  // -- Form handlers ---------------------------------------------------------

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectPatient = (patient: PatientOption) => {
    setSelectedPatient(patient);
    setForm((prev) => ({ ...prev, patientId: patient.id }));
    setPatientSearch(
      `${patient.lastName} ${patient.firstName} ${patient.fatherName}`
    );
    setShowPatientDropdown(false);
  };

  const openModal = () => {
    setForm(emptyForm);
    setSelectedPatient(null);
    setPatientSearch('');
    setPatientOptions([]);
    setShowPatientDropdown(false);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId) {
      setFormError(t.appointments.selectPatient);
      return;
    }
    if (!form.type) {
      setFormError(t.common.error);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, string> = {
        patientId: form.patientId,
        doctorId: form.doctorId,
        type: form.type,
        dateTime: new Date().toISOString(),
      };
      if (form.notes) body.notes = form.notes;

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowModal(false);
      setDateFilter(today);
      fetchAppointments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  // -- Render ----------------------------------------------------------------

  const doctorFilterOptions = doctors.filter((d) =>
    DOCTOR_ROLES.includes(d.role)
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {t.appointments.title}
        </h1>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t.appointments.addAppointment}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-4 border border-slate-200 flex flex-wrap items-center gap-3">
        {/* Date */}
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-sm text-slate-700 focus:outline-none bg-transparent"
          />
        </div>

        {/* Doctor */}
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t.appointments.allDoctors}</option>
          {doctorFilterOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t.appointments.allStatuses}</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.appointments.status[s]}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t.appointments.allTypes}</option>
          {ALL_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {TYPE_LABELS[tp]}
            </option>
          ))}
        </select>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-10">
                  #
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  {t.appointments.patient}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  {t.appointments.doctor}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  {t.appointments.type}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  {t.appointments.scheduledAt}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  {t.appointments.queue}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  {t.common.status}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-12 text-slate-400"
                  >
                    {t.appointments.noAppointments}
                  </td>
                </tr>
              ) : (
                appointments.map((appt, idx) => (
                  <tr
                    key={appt.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500">{idx + 1}</td>

                    {/* Patient */}
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {appt.patient.lastName} {appt.patient.firstName}
                    </td>

                    {/* Doctor */}
                    <td className="px-4 py-3 text-slate-600">
                      {appt.doctor.name}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 text-slate-600">
                      {TYPE_LABELS[appt.type as AppointmentType] ?? appt.type}
                    </td>

                    {/* DateTime */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(appt.dateTime).toLocaleString('uz-UZ', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Queue */}
                    <td className="px-4 py-3">
                      {appt.queue ? (
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                          #{appt.queue.queueNumber}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          STATUS_BADGE[appt.status as AppointmentStatus] ??
                          'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {t.appointments.status[
                          appt.status as AppointmentStatus
                        ] ?? appt.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Quick status change */}
                        <select
                          value={appt.status}
                          onChange={(e) =>
                            handleStatusChange(
                              appt.id,
                              e.target.value as AppointmentStatus
                            )
                          }
                          disabled={appt.status === 'CANCELLED' || appt.status === 'COMPLETED' || appt.status === 'NO_SHOW'}
                          className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t.appointments.status[s]}
                            </option>
                          ))}
                        </select>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(appt.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title={t.common.delete}
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* -- Add Appointment Modal -- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {t.appointments.addAppointment}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {formError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Patient search */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.appointments.patient}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={patientDropdownRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t.appointments.selectPatient}
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setSelectedPatient(null);
                      setForm((prev) => ({ ...prev, patientId: '' }));
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {patientSearchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-400" />
                  )}
                  {showPatientDropdown && patientOptions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {patientOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          {p.lastName} {p.firstName} {p.fatherName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPatient && (
                  <p className="text-xs text-green-600 mt-0.5">
                    {selectedPatient.lastName} {selectedPatient.firstName}{' '}
                    {selectedPatient.fatherName}
                  </p>
                )}
              </div>

              {/* Doctor */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.appointments.doctor}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  name="doctorId"
                  value={form.doctorId}
                  onChange={handleFormChange}
                  required
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t.appointments.selectDoctor}</option>
                  {doctors
                    .filter((d) => DOCTOR_ROLES.includes(d.role))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.appointments.type}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleFormChange}
                  required
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t.appointments.allTypes}</option>
                  {ALL_TYPES.map((tp) => (
                    <option key={tp} value={tp}>
                      {TYPE_LABELS[tp]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.appointments.notes}
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  rows={3}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
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
