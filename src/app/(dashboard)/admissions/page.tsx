'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  BedDouble,
  Search,
  LogOut,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
}

interface BedOption {
  id: string;
  bedNumber: string;
  room: {
    roomNumber: string;
    floor: number;
  };
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Admission {
  id: string;
  status: 'ACTIVE' | 'DISCHARGED';
  admittedAt: string;
  dischargedAt: string | null;
  diagnosis: string | null;
  dailyRate: number;
  dischargeNotes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    fatherName: string;
  };
  bed: {
    id: string;
    bedNumber: string;
    room: {
      roomNumber: string;
      floor: number;
    };
  };
  staff: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface DischargeResult {
  days: number;
  payment: { amount: number } | null;
  free: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number, sum: string): string {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' ' + sum;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CAN_MANAGE_ROLES = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE'];

export default function AdmissionsPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();

  const canManage = CAN_MANAGE_ROLES.includes(session?.user?.role ?? '');

  // ── List state ──
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Add Admission Modal ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientRef = useRef<HTMLDivElement>(null);

  // Bed options
  const [bedOptions, setBedOptions] = useState<BedOption[]>([]);
  const [bedLoading, setBedLoading] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState('');

  // Doctor options
  const [doctorOptions, setDoctorOptions] = useState<StaffOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Form fields
  const [diagnosis, setDiagnosis] = useState('');
  const [dailyRate, setDailyRate] = useState('');

  // ── Discharge Modal ──
  const [dischargeAdmission, setDischargeAdmission] = useState<Admission | null>(null);
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [dischargeSaving, setDischargeSaving] = useState(false);
  const [dischargeError, setDischargeError] = useState<string | null>(null);
  const [dischargeResult, setDischargeResult] = useState<DischargeResult | null>(null);

  // ─── Fetch admissions ──────────────────────────────────────────────────────

  const fetchAdmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admissions?status=ACTIVE');
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setAdmissions(json.data ?? json);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    fetchAdmissions();
  }, [fetchAdmissions]);

  // ─── Patient search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatientOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setPatientLoading(true);
      try {
        const res = await fetch(
          `/api/patients?search=${encodeURIComponent(patientSearch)}&limit=10`
        );
        if (!res.ok) return;
        const json = await res.json();
        setPatientOptions(json.data ?? json);
      } finally {
        setPatientLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Close patient dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Load beds & doctors when modal opens ─────────────────────────────────

  useEffect(() => {
    if (!showAddModal) return;

    (async () => {
      setBedLoading(true);
      try {
        const res = await fetch('/api/beds?status=AVAILABLE');
        if (!res.ok) return;
        const json = await res.json();
        setBedOptions(json.data ?? json);
      } finally {
        setBedLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/staff?role=DOCTOR');
        if (!res.ok) return;
        const json = await res.json();
        setDoctorOptions(json.data ?? json);
      } catch { /* ignore */ }
    })();
  }, [showAddModal]);

  // ─── Open / reset add modal ───────────────────────────────────────────────

  const openAddModal = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setPatientOptions([]);
    setSelectedBedId('');
    setSelectedDoctorId('');
    setDiagnosis('');
    setDailyRate('');
    setAddError(null);
    setShowAddModal(true);
  };

  // ─── Submit new admission ─────────────────────────────────────────────────

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setAddError(t.admissions.selectPatient);
      return;
    }
    if (!selectedBedId) {
      setAddError(t.admissions.selectBed);
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const body: Record<string, string | number | undefined> = {
        patientId: selectedPatient.id,
        bedId: selectedBedId,
      };
      if (selectedDoctorId) body.staffId = selectedDoctorId;
      if (diagnosis.trim()) body.diagnosis = diagnosis.trim();
      body.dailyRate = Number(dailyRate) || 0;

      const res = await fetch('/api/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? t.common.error);
      }

      setShowAddModal(false);
      fetchAdmissions();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setAddSaving(false);
    }
  };

  // ─── Discharge ────────────────────────────────────────────────────────────

  const openDischarge = (admission: Admission) => {
    setDischargeAdmission(admission);
    setDischargeNotes('');
    setDischargeError(null);
    setDischargeResult(null);
  };

  const handleDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dischargeAdmission) return;
    setDischargeSaving(true);
    setDischargeError(null);
    try {
      const res = await fetch(`/api/admissions/${dischargeAdmission.id}/discharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dischargeNotes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? t.common.error);
      }
      const json = await res.json();
      setDischargeResult({
        days: json.days ?? 0,
        payment: json.payment ?? null,
        free: json.free ?? false,
      });
      fetchAdmissions();
    } catch (err) {
      setDischargeError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDischargeSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t.admissions.title}</h1>
        {canManage && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t.admissions.addAdmission}
          </button>
        )}
      </div>

      {/* Error */}
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
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.admissions.patient}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  {t.admissions.room} / {t.admissions.bed}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.admissions.admittedAt}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.admissions.diagnosis}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.admissions.dailyRate}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.common.status}</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <BedDouble className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-400 text-sm">{t.admissions.noActive}</p>
                  </td>
                </tr>
              ) : (
                admissions.map((adm) => (
                  <tr key={adm.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    {/* Patient */}
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {adm.patient.lastName} {adm.patient.firstName} {adm.patient.fatherName}
                    </td>
                    {/* Room / Bed */}
                    <td className="px-4 py-3 text-slate-600">
                      <span className="font-medium">
                        {t.admissions.room} {adm.bed.room.roomNumber}
                      </span>
                      <span className="text-slate-400 mx-1">/</span>
                      {t.admissions.bed} {adm.bed.bedNumber}
                      <span className="block text-xs text-slate-400">
                        {adm.bed.room.floor}{t.rooms.floorLabel}
                      </span>
                    </td>
                    {/* Admitted at */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(adm.admittedAt)}
                    </td>
                    {/* Diagnosis */}
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                      {adm.diagnosis ?? '—'}
                    </td>
                    {/* Daily rate */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {adm.dailyRate > 0 ? formatCurrency(adm.dailyRate, t.common.sum) : '—'}
                    </td>
                    {/* Status badge */}
                    <td className="px-4 py-3">
                      {adm.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {t.admissions.active}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {t.admissions.discharged}
                        </span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {canManage && adm.status === 'ACTIVE' && (
                        <button
                          onClick={() => openDischarge(adm)}
                          className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          {t.admissions.discharge}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Admission Modal ────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-slate-800">{t.admissions.addAdmission}</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 flex flex-col gap-4">
              {addError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {addError}
                </div>
              )}

              {/* Patient search */}
              <div className="flex flex-col gap-1" ref={patientRef}>
                <label className="text-sm font-medium text-slate-700">
                  {t.admissions.patient} <span className="text-red-500">*</span>
                </label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-blue-800">
                      {selectedPatient.lastName} {selectedPatient.firstName} {selectedPatient.fatherName}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setSelectedPatient(null); setPatientSearch(''); }}
                      className="text-blue-400 hover:text-blue-600 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        setShowPatientDropdown(true);
                      }}
                      onFocus={() => setShowPatientDropdown(true)}
                      placeholder={t.admissions.selectPatient}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {showPatientDropdown && (patientLoading || patientOptions.length > 0) && (
                      <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {patientLoading ? (
                          <div className="flex justify-center py-3">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          </div>
                        ) : (
                          patientOptions.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPatient(p);
                                setShowPatientDropdown(false);
                                setPatientSearch('');
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                            >
                              <span className="font-medium text-slate-800">
                                {p.lastName} {p.firstName} {p.fatherName}
                              </span>
                              <span className="block text-xs text-slate-400">{p.phone}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bed select */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.admissions.bed} <span className="text-red-500">*</span>
                </label>
                {bedLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm px-3 py-2 border border-slate-200 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.common.loading}
                  </div>
                ) : (
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    required
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t.admissions.selectBed}</option>
                    {bedOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {t.admissions.room} {b.room.roomNumber} — {t.admissions.bed} {b.bedNumber} ({b.room.floor}{t.rooms.floorLabel})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Doctor select */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.admissions.doctor}</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t.admissions.selectDoctor}</option>
                  {doctorOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.lastName} {d.firstName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Diagnosis */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.admissions.diagnosis}</label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={3}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Daily rate */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.admissions.dailyRate}</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  placeholder="0"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {addSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Discharge Modal ────────────────────────────────────────────────── */}
      {dischargeAdmission !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{t.admissions.discharge}</h2>
              <button
                onClick={() => setDischargeAdmission(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Patient name */}
              <div className="bg-slate-50 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-slate-500 mb-0.5">{t.admissions.patient}</p>
                <p className="font-semibold text-slate-800">
                  {dischargeAdmission.patient.lastName}{' '}
                  {dischargeAdmission.patient.firstName}{' '}
                  {dischargeAdmission.patient.fatherName}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t.admissions.admittedAt}: {formatDate(dischargeAdmission.admittedAt)}
                </p>
              </div>

              {/* Discharge result banner */}
              {dischargeResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-800">
                  {dischargeResult.free
                    ? t.admissions.free
                    : dischargeResult.payment
                    ? `${dischargeResult.days} ${t.admissions.days}, ${formatCurrency(dischargeResult.payment.amount, t.common.sum)} ${t.payments.categories.INPATIENT.toLowerCase()}`
                    : `${dischargeResult.days} ${t.admissions.days}`}
                </div>
              )}

              {dischargeError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {dischargeError}
                </div>
              )}

              {!dischargeResult && (
                <form onSubmit={handleDischarge} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">
                      {t.admissions.dischargeNotes}
                    </label>
                    <textarea
                      value={dischargeNotes}
                      onChange={(e) => setDischargeNotes(e.target.value)}
                      rows={3}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setDischargeAdmission(null)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={dischargeSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {dischargeSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <LogOut className="w-4 h-4" />
                      {t.admissions.discharge}
                    </button>
                  </div>
                </form>
              )}

              {dischargeResult && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setDischargeAdmission(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {t.common.close}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
