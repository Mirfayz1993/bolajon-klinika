'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Search,
  LogOut,
  BedDouble,
  Stethoscope,
  ScanLine,
  Clock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  room: { roomNumber: string; floor: number };
}

interface AmbulatoryAdmission {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'DISCHARGED';
  admittedAt: string;
  dischargedAt: string | null;
  diagnosis: string | null;
  patient: { id: string; firstName: string; lastName: string; fatherName: string; phone: string };
  bed: { id: string; bedNumber: string; room: { roomNumber: string; floor: number } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
}

// ─── Roles ────────────────────────────────────────────────────────────────────

const CAN_MANAGE = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE', 'NURSE', 'RECEPTIONIST'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AmbulatoryPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const canManage = CAN_MANAGE.includes(session?.user?.role ?? '');

  // List
  const [admissions, setAdmissions] = useState<AmbulatoryAdmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const patientRef = useRef<HTMLDivElement>(null);

  // Bed options (ambulatory only)
  const [bedOptions, setBedOptions] = useState<BedOption[]>([]);
  const [bedLoading, setBedLoading] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState('');

  const [prescriptionNotes, setPrescriptionNotes] = useState('');

  // Discharge modal
  const [dischargeAdm, setDischargeAdm] = useState<AmbulatoryAdmission | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [dischargeSaving, setDischargeSaving] = useState(false);
  const [dischargeError, setDischargeError] = useState<string | null>(null);
  const [dischargeResult, setDischargeResult] = useState<{ amount: number } | null>(null);

  // QR Scan
  const [qrInput, setQrInput] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const [qrResult, setQrResult] = useState<{ success: boolean; message: string } | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchAdmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter === 'ACTIVE'
        ? '/api/ambulatory?status=ACTIVE'
        : '/api/ambulatory';
      const res = await fetch(url);
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setAdmissions(json.data ?? []);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t.common.error]);

  useEffect(() => { fetchAdmissions(); }, [fetchAdmissions]);

  // ─── Patient search ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!patientSearch.trim()) { setPatientOptions([]); return; }
    const timer = setTimeout(async () => {
      setPatientLoading(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=10`);
        if (!res.ok) return;
        const json = await res.json();
        setPatientOptions(json.data ?? json);
      } finally {
        setPatientLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Load beds when modal opens ───────────────────────────────────────────

  useEffect(() => {
    if (!showAdd) return;
    setBedLoading(true);
    fetch('/api/beds?status=AVAILABLE&ambulatory=true')
      .then((r) => r.json())
      .then((d) => setBedOptions(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {})
      .finally(() => setBedLoading(false));
  }, [showAdd]);

  // ─── Open/reset add modal ─────────────────────────────────────────────────

  const openAdd = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setPatientOptions([]);
    setSelectedBedId('');
    setPrescriptionNotes('');
    setAddError(null);
    setShowAdd(true);
  };

  // ─── Submit new ambulatory ────────────────────────────────────────────────

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) { setAddError('Bemor tanlang'); return; }
    if (!selectedBedId) { setAddError("To'shak tanlang"); return; }
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch('/api/ambulatory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          bedId: selectedBedId,
          notes: prescriptionNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? t.common.error);
      }
      setShowAdd(false);
      fetchAdmissions();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setAddSaving(false);
    }
  };

  // ─── Discharge ────────────────────────────────────────────────────────────

  const openDischarge = (adm: AmbulatoryAdmission) => {
    setDischargeAdm(adm);
    setPayAmount('');
    setPayMethod('CASH');
    setDischargeNotes('');
    setDischargeError(null);
    setDischargeResult(null);
  };

  const handleDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dischargeAdm) return;
    setDischargeSaving(true);
    setDischargeError(null);
    try {
      const res = await fetch(`/api/ambulatory/${dischargeAdm.id}/discharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentAmount: Number(payAmount) || 0,
          paymentMethod: payMethod,
          notes: dischargeNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? t.common.error);
      }
      const json = await res.json();
      if (json.payment) setDischargeResult({ amount: json.payment.amount });
      else setDischargeResult({ amount: 0 });
      fetchAdmissions();
    } catch (err) {
      setDischargeError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDischargeSaving(false);
    }
  };

  // ─── QR Scan ──────────────────────────────────────────────────────────────

  const handleQrScan = async (patientIdRaw: string) => {
    const patientId = patientIdRaw.trim();
    if (!patientId) return;
    setQrBusy(true);
    setQrResult(null);
    try {
      const res = await fetch('/api/ambulatory/qr-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (res.ok) {
        setQrResult({ success: true, message: data.message ?? 'Muvaffaqiyatli' });
        fetchAdmissions();
      } else {
        setQrResult({ success: false, message: data.error ?? 'Xatolik' });
      }
    } catch {
      setQrResult({ success: false, message: 'Server xatosi' });
    } finally {
      setQrBusy(false);
      setQrInput('');
      setTimeout(() => setQrResult(null), 6000);
    }
  };

  const handleQrKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQrScan(qrInput);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-teal-600" />
            Ambulator bo&apos;lim
          </h1>
          <p className="text-sm text-slate-500 mt-1">3-qavat — qisqa muddatli muolaja (ukol, infuziya)</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ACTIVE' | 'ALL')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ACTIVE">Faol</option>
            <option value="ALL">Barchasi</option>
          </select>
          {canManage && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Joylashtirish
            </button>
          )}
        </div>
      </div>

      {/* QR Skaner */}
      {canManage && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-teal-600" /> QR Skaner (Hamshira stoli)
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Bemorning QR kodini skanerlang — KUTMOQDA → qabul, MUOLAJADA → tugatish
          </p>
          <div className="flex gap-2 max-w-md">
            <input
              ref={qrInputRef}
              type="text"
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={handleQrKeyDown}
              placeholder="Bemorning QR kodini skanerlang..."
              disabled={qrBusy}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            />
            <button
              onClick={() => handleQrScan(qrInput)}
              disabled={qrBusy || !qrInput.trim()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {qrBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              Skanerlash
            </button>
          </div>
          {qrResult && (
            <div className={`mt-3 px-4 py-3 rounded-lg text-sm font-medium ${
              qrResult.success
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {qrResult.message}
            </div>
          )}
        </div>
      )}

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
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Bemor</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Xona / To&apos;shak</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Joylashtirilgan</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Izoh / Retsept</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Holat</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" />
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <BedDouble className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-400 text-sm">Faol ambulator bemorlar yo&apos;q</p>
                  </td>
                </tr>
              ) : (
                admissions.map((adm) => (
                  <tr key={adm.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    adm.status === 'PENDING' ? 'bg-amber-50/50' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {adm.patient.lastName} {adm.patient.firstName} {adm.patient.fatherName}
                      </p>
                      <p className="text-xs text-slate-400">{adm.patient.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="font-medium">Xona {adm.bed.room.roomNumber}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      To&apos;shak {adm.bed.bedNumber}
                      <span className="block text-xs text-slate-400">{adm.bed.room.floor}-qavat</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                      {formatDate(adm.admittedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate">
                      {adm.diagnosis ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {adm.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3" /> Kutmoqda
                        </span>
                      ) : adm.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                          Muolajada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          Chiqarilgan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && adm.status === 'ACTIVE' && (
                        <button
                          onClick={() => openDischarge(adm)}
                          className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Chiqarish + To&apos;lov
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

      {/* ── Add Modal ─────────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-slate-800">Ambulator joylashtirish</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
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
                <label className="text-sm font-medium text-slate-700">Bemor <span className="text-red-500">*</span></label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-teal-800">
                      {selectedPatient.lastName} {selectedPatient.firstName} {selectedPatient.fatherName}
                    </span>
                    <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-teal-400 hover:text-teal-600 ml-2">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDrop(true); }}
                      onFocus={() => setShowPatientDrop(true)}
                      placeholder="Bemor qidiring..."
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {showPatientDrop && (patientLoading || patientOptions.length > 0) && (
                      <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {patientLoading ? (
                          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-teal-500" /></div>
                        ) : (
                          patientOptions.map((p) => (
                            <button key={p.id} type="button"
                              onClick={() => { setSelectedPatient(p); setShowPatientDrop(false); setPatientSearch(''); }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                            >
                              <span className="font-medium text-slate-800">{p.lastName} {p.firstName} {p.fatherName}</span>
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
                <label className="text-sm font-medium text-slate-700">Bo&apos;sh ambulator to&apos;shak (3-qavat) <span className="text-red-500">*</span></label>
                {bedLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm px-3 py-2 border border-slate-200 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t.common.loading}
                  </div>
                ) : bedOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-400 border border-slate-200 rounded-lg">
                    Bo&apos;sh ambulator to&apos;shak yo&apos;q. Avval 3-qavat xonasiga isAmbulatory=true qo&apos;ying.
                  </div>
                ) : (
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    required
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">— To&apos;shak tanlang —</option>
                    {bedOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        Xona {b.room.roomNumber} / To&apos;shak {b.bedNumber} ({b.room.floor}-qavat)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Retsept / Izoh</label>
                <textarea
                  value={prescriptionNotes}
                  onChange={(e) => setPrescriptionNotes(e.target.value)}
                  rows={3}
                  placeholder="Masalan: Paracetamol 500mg ukol, 1 marta..."
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={addSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {addSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Joylashtirish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Discharge Modal ───────────────────────────────────────────────── */}
      {dischargeAdm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Chiqarish va To&apos;lov</h2>
              <button onClick={() => setDischargeAdm(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-slate-50 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-slate-500 mb-0.5">Bemor</p>
                <p className="font-semibold text-slate-800">
                  {dischargeAdm.patient.lastName} {dischargeAdm.patient.firstName} {dischargeAdm.patient.fatherName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Xona {dischargeAdm.bed.room.roomNumber} / To&apos;shak {dischargeAdm.bed.bedNumber}
                </p>
              </div>

              {dischargeResult ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-800">
                  {dischargeResult.amount > 0
                    ? `To'lov: ${formatCurrency(dischargeResult.amount)} qabul qilindi. Bemor chiqarildi.`
                    : 'Bemor muvaffaqiyatli chiqarildi (to\'lovsiz).'}
                </div>
              ) : (
                <form onSubmit={handleDischarge} className="flex flex-col gap-4">
                  {dischargeError && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {dischargeError}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">To&apos;lov miqdori (so&apos;m)</label>
                    <input
                      type="number"
                      min={0}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0 (bepul)"
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">To&apos;lov usuli</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="CASH">Naqd pul</option>
                      <option value="CARD">Karta</option>
                      <option value="CLICK">Click</option>
                      <option value="PAYME">Payme</option>
                      <option value="BANK_TRANSFER">Bank o&apos;tkazmasi</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">Izoh</label>
                    <textarea
                      value={dischargeNotes}
                      onChange={(e) => setDischargeNotes(e.target.value)}
                      rows={2}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button type="button" onClick={() => setDischargeAdm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                      {t.common.cancel}
                    </button>
                    <button type="submit" disabled={dischargeSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {dischargeSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <LogOut className="w-4 h-4" />
                      Chiqarish
                    </button>
                  </div>
                </form>
              )}

              {dischargeResult && (
                <div className="flex justify-end">
                  <button onClick={() => setDischargeAdm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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
