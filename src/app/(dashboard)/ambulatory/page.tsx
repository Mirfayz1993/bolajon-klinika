'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { floorLabel } from '@/lib/utils';
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
  History,
  ChevronRight,
  Building2,
  Pill,
} from 'lucide-react';

// --- Types --------------------------------------------------------------------

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

interface AmbRoomBedPatient {
  id: string;
  firstName: string;
  lastName: string;
}

interface AmbRoomBed {
  id: string;
  bedNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  admissions: { id: string; patient: AmbRoomBedPatient }[];
}

interface AmbRoomWithBeds {
  id: string;
  roomNumber: string;
  floor: number;
  type: string;
  isAmbulatory: boolean;
  beds: AmbRoomBed[];
}

// --- Ambulatory Bed Card ------------------------------------------------------

function AmbBedCard({
  bed,
  onOccupiedClick,
}: {
  bed: AmbRoomBed;
  onOccupiedClick: (patientId: string) => void;
}) {
  const { t } = useLanguage();
  const patient = bed.admissions?.[0]?.patient;

  if (patient) {
    return (
      <button
        onClick={() => onOccupiedClick(patient.id)}
        className="flex flex-col items-center gap-0.5 p-2 bg-red-50 border border-red-200 rounded-lg min-w-[68px] hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
        title={`${patient.firstName} ${patient.lastName}`}
      >
        <BedDouble className="w-4 h-4 text-red-600" />
        <span className="text-xs font-semibold text-red-700">{bed.bedNumber}</span>
        <span className="text-[10px] font-medium text-red-600 leading-tight max-w-[64px] truncate text-center">
          {patient.firstName} {patient.lastName}
        </span>
      </button>
    );
  }

  if (bed.status === 'MAINTENANCE') {
    return (
      <div className="flex flex-col items-center gap-0.5 p-2 bg-yellow-50 border border-yellow-200 rounded-lg min-w-[68px]">
        <BedDouble className="w-4 h-4 text-yellow-600" />
        <span className="text-xs font-semibold text-yellow-700">{bed.bedNumber}</span>
        <span className="text-[10px] font-medium text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
          {t.rooms.maintenance}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5 p-2 bg-green-50 border border-green-200 rounded-lg min-w-[68px]">
      <BedDouble className="w-4 h-4 text-green-600" />
      <span className="text-xs font-semibold text-green-700">{bed.bedNumber}</span>
      <span className="text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
        {t.rooms.available}
      </span>
    </div>
  );
}

// --- Helpers ------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// --- Main Component -----------------------------------------------------------

export default function AmbulatoryPage() {
  const { t } = useLanguage();
  const { can } = usePermissions();
  const router = useRouter();
  const canManage = can('/ambulatory:create');
  const canDischarge = can('/ambulatory:discharge');

  // All admissions (active + discharged)
  const [allAdmissions, setAllAdmissions] = useState<AmbulatoryAdmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Room map
  const [ambRooms, setAmbRooms] = useState<AmbRoomWithBeds[]>([]);
  const [ambRoomsLoading, setAmbRoomsLoading] = useState(false);

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
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [dischargeSaving, setDischargeSaving] = useState(false);
  const [dischargeError, setDischargeError] = useState<string | null>(null);
  const [dischargeDone, setDischargeDone] = useState(false);

  // Expiry medicines (floor=2)
  const [expiryMeds, setExpiryMeds] = useState<{id:string;name:string;expiryDate:string;quantity:number}[]>([]);
  useEffect(() => {
    fetch('/api/medicines?floor=2&expiringSoon=true&writtenOff=false')
      .then(r => r.json())
      .then(d => setExpiryMeds(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Dori berish modal
  interface MedOption { id: string; name: string; type: string; price: number; quantity: number; }
  const [showMedModal, setShowMedModal] = useState(false);
  const [medPatient, setMedPatient] = useState<AmbulatoryAdmission | null>(null);
  const [ambMeds, setAmbMeds] = useState<MedOption[]>([]);
  const [ambMedsLoading, setAmbMedsLoading] = useState(false);
  const [selMedId, setSelMedId] = useState('');
  const [medQty, setMedQty] = useState('1');
  const [medSaving, setMedSaving] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);

  useEffect(() => {
    if (!showMedModal) return;
    setAmbMedsLoading(true);
    fetch('/api/medicines?floor=2&writtenOff=false')
      .then(r => r.json())
      .then(d => setAmbMeds(Array.isArray(d) ? d : []))
      .catch(() => setAmbMeds([]))
      .finally(() => setAmbMedsLoading(false));
  }, [showMedModal]);

  function openMedModal(adm: AmbulatoryAdmission) {
    setMedPatient(adm);
    setSelMedId('');
    setMedQty('1');
    setMedError(null);
    setShowMedModal(true);
  }

  async function handleMedDispense(e: React.FormEvent) {
    e.preventDefault();
    if (!medPatient || !selMedId) return;
    setMedSaving(true);
    setMedError(null);
    try {
      const res = await fetch('/api/medicine-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicineId: selMedId, type: 'OUT', quantity: Number(medQty), patientId: medPatient.patient.id }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Xato'); }
      setShowMedModal(false);
    } catch (err) {
      setMedError(err instanceof Error ? err.message : 'Xato');
    } finally {
      setMedSaving(false);
    }
  }

  // QR Scan
  const [qrInput, setQrInput] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const [qrResult, setQrResult] = useState<{ success: boolean; message: string } | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // --- Fetch ----------------------------------------------------------------

  const fetchAdmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ambulatory');
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setAllAdmissions(json.data ?? []);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  const fetchAmbRooms = useCallback(async () => {
    setAmbRoomsLoading(true);
    try {
      const res = await fetch('/api/rooms?isAmbulatory=true&include=beds');
      if (!res.ok) return;
      const json = await res.json();
      setAmbRooms(Array.isArray(json) ? json : (json.data ?? []));
    } catch { /* ignore */ } finally {
      setAmbRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmissions();
    fetchAmbRooms();
  }, [fetchAdmissions, fetchAmbRooms]);

  // Split admissions
  const activeAdmissions = allAdmissions.filter(a => a.status !== 'DISCHARGED');
  const dischargedAdmissions = allAdmissions.filter(a => a.status === 'DISCHARGED');

  // Displayed active list (filter by showAll)
  const displayedActive = showAll ? activeAdmissions : activeAdmissions.filter(a => a.status === 'ACTIVE');

  // --- Patient search -------------------------------------------------------

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

  // --- Load beds when modal opens -------------------------------------------

  useEffect(() => {
    if (!showAdd) return;
    setBedLoading(true);
    fetch('/api/beds?status=AVAILABLE&ambulatory=true')
      .then((r) => r.json())
      .then((d) => setBedOptions(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {})
      .finally(() => setBedLoading(false));
  }, [showAdd]);

  // --- Open/reset add modal -------------------------------------------------

  const openAdd = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setPatientOptions([]);
    setSelectedBedId('');
    setPrescriptionNotes('');
    setAddError(null);
    setShowAdd(true);
  };

  // --- Submit new ambulatory ------------------------------------------------

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
      fetchAmbRooms();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setAddSaving(false);
    }
  };

  // --- Discharge ------------------------------------------------------------

  const openDischarge = (adm: AmbulatoryAdmission, e: React.MouseEvent) => {
    e.stopPropagation();
    setDischargeAdm(adm);
    setDischargeNotes('');
    setDischargeError(null);
    setDischargeDone(false);
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
          notes: dischargeNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? t.common.error);
      }
      setDischargeDone(true);
      fetchAdmissions();
      fetchAmbRooms();
    } catch (err) {
      setDischargeError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDischargeSaving(false);
    }
  };

  // --- QR Scan --------------------------------------------------------------

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
        fetchAmbRooms();
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

  // --- Navigate to patient nurse-notes --------------------------------------

  const goToPatientNotes = (patientId: string) => {
    router.push(`/patients/${patientId}?tab=nurse-notes&noteType=AMBULATORY&from=ambulatory`);
  };

  // --- Render ---------------------------------------------------------------

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-teal-600" />
            Ambulator bo&apos;lim
          </h1>
          <p className="text-sm text-slate-500 mt-1">2-qavat — qisqa muddatli muolaja (ukol, infuziya)</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={e => setShowAll(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Kutayotganlar ham
          </label>
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

      {/* Expiry alert for floor=2 medicines */}
      {expiryMeds.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-orange-800 mb-2">⚠️ 2-qavat dorilar — muddati tugayotgan ({expiryMeds.length} ta):</p>
          <div className="flex flex-wrap gap-2">
            {expiryMeds.map(m => {
              const exp = new Date(m.expiryDate);
              const isExpired = exp < new Date();
              return (
                <span key={m.id} className={`text-xs px-2 py-1 rounded-full font-medium ${isExpired ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  {m.name} — {exp.toLocaleDateString('uz-UZ')} {isExpired ? '(muddati o\'tgan)' : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Room Map */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">2-qavat xona xaritasi</h2>
          {ambRoomsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>
        {ambRooms.length === 0 && !ambRoomsLoading ? (
          <div className="text-center py-6 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            {t.rooms.noRooms}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {ambRooms.map(room => {
              const avail = room.beds.filter(b => b.status === 'AVAILABLE').length;
              const occ = room.beds.filter(b => b.status === 'OCCUPIED').length;
              return (
                <div key={room.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-teal-500" />
                      <span className="text-sm font-semibold text-slate-800">
                        {t.rooms.number} {room.roomNumber}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
                      {room.type}
                    </span>
                  </div>
                  {room.beds.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        {avail}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        {occ}
                      </span>
                    </div>
                  )}
                  {room.beds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {room.beds.map(bed => (
                        <AmbBedCard
                          key={bed.id}
                          bed={bed}
                          onOccupiedClick={(patientId) =>
                            router.push(`/patients/${patientId}?tab=nurse&noteType=AMBULATORY&from=ambulatory`)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-2">
                      {t.rooms.beds}: 0
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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

      {/* Active patients table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-8">
        <div className="px-4 py-3 bg-teal-50 border-b border-teal-100">
          <h2 className="text-sm font-semibold text-teal-800">Faol bemorlar ({activeAdmissions.length})</h2>
          <p className="text-xs text-teal-600 mt-0.5">Qatorni bosib bemorning hamshira qaydlariga o&apos;tishingiz mumkin</p>
        </div>
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
              ) : displayedActive.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <BedDouble className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-400 text-sm">Faol ambulator bemorlar yo&apos;q</p>
                  </td>
                </tr>
              ) : (
                displayedActive.map((adm) => (
                  <tr
                    key={adm.id}
                    onClick={() => goToPatientNotes(adm.patient.id)}
                    className={`border-b border-slate-100 hover:bg-teal-50 transition-colors cursor-pointer ${
                      adm.status === 'PENDING' ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-slate-800">
                            {adm.patient.lastName} {adm.patient.firstName} {adm.patient.fatherName}
                          </p>
                          <p className="text-xs text-slate-400">{adm.patient.phone}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="font-medium">Xona {adm.bed.room.roomNumber}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      To&apos;shak {adm.bed.bedNumber}
                      <span className="block text-xs text-slate-400">{floorLabel(adm.bed.room.floor)}</span>
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
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                          Muolajada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {adm.status === 'ACTIVE' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openMedModal(adm); }}
                            className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Pill className="w-3.5 h-3.5" />
                            Dori
                          </button>
                          {canDischarge && (
                            <button
                              onClick={(e) => openDischarge(adm, e)}
                              className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              Chiqarish
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Faoliyat tarixi</h2>
          <span className="ml-auto text-xs text-slate-400">{dischargedAdmissions.length} ta yozuv</span>
        </div>
        {dischargedAdmissions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            Hali chiqarilgan bemorlar yo&apos;q
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs">Bemor</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs">Xizmat / Izoh</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs">Keldi</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs">Chiqdi</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs">Xona</th>
                </tr>
              </thead>
              <tbody>
                {dischargedAdmissions.map((adm) => (
                  <tr
                    key={adm.id}
                    onClick={() => goToPatientNotes(adm.patient.id)}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-700 text-xs">
                        {adm.patient.lastName} {adm.patient.firstName}
                      </p>
                      <p className="text-xs text-slate-400">{adm.patient.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">
                      {adm.diagnosis ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateShort(adm.admittedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {adm.dischargedAt ? formatDateShort(adm.dischargedAt) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {adm.bed.room.roomNumber}/{adm.bed.bedNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* -- Add Modal ------------------------------------------------------- */}
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
                        Xona {b.room.roomNumber} / To&apos;shak {b.bedNumber} ({floorLabel(b.room.floor)})
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

      {/* -- Discharge Modal ------------------------------------------------- */}
      {dischargeAdm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Bemorni chiqarish</h2>
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
                <p className="text-xs text-slate-400 mt-0.5">
                  Keldi: {formatDate(dischargeAdm.admittedAt)}
                </p>
              </div>

              {dischargeDone ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-800">
                  Bemor muvaffaqiyatli chiqarildi.
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
                    <label className="text-sm font-medium text-slate-700">Izoh (ixtiyoriy)</label>
                    <textarea
                      value={dischargeNotes}
                      onChange={(e) => setDischargeNotes(e.target.value)}
                      rows={3}
                      placeholder="Muolaja natijalari, tavsiyalar..."
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

              {dischargeDone && (
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

      {/* -- Dori berish Modal ----------------------------------------------- */}
      {showMedModal && medPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-teal-600" />
                  Dori berish
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {medPatient.patient.lastName} {medPatient.patient.firstName}
                </p>
              </div>
              <button onClick={() => setShowMedModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMedDispense} className="p-6 space-y-4">
              {medError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {medError}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Dori <span className="text-red-500">*</span></label>
                {ambMedsLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...</div>
                ) : ambMeds.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">2-qavat shkafida dori topilmadi</p>
                ) : (
                  <select
                    value={selMedId}
                    onChange={e => setSelMedId(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">— Dorini tanlang —</option>
                    {ambMeds.map(m => (
                      <option key={m.id} value={m.id} disabled={m.quantity === 0}>
                        {m.name} ({m.type}) — {Number(m.price).toLocaleString()} so&apos;m — zaxira: {m.quantity}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Miqdor <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={1}
                  max={ambMeds.find(m => m.id === selMedId)?.quantity ?? 999}
                  value={medQty}
                  onChange={e => setMedQty(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              {selMedId && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-sm text-teal-800">
                  Jami: {(Number(ambMeds.find(m=>m.id===selMedId)?.price ?? 0) * Number(medQty || 1)).toLocaleString()} so&apos;m
                  <span className="text-teal-600 ml-2">(bemor profiliga yoziladi)</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowMedModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Bekor
                </button>
                <button type="submit" disabled={medSaving || !selMedId} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                  {medSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Pill className="w-4 h-4" />
                  Berish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
