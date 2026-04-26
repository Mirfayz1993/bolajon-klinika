'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  BedDouble,
  Search,
  LogOut,
  Building2,
  Pill,
} from 'lucide-react';
import { floorLabel } from '@/lib/utils';

// --- Types -------------------------------------------------------------------

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
  admissionDate: string;
  dischargeDate: string | null;
  notes: string | null;
  dailyRate: number;
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
}

interface DischargeResult {
  days: number;
  payment: { amount: number } | null;
  free: boolean;
}

interface MedOption {
  id: string;
  name: string;
  type: string;
  price: number;
  quantity: number;
}

interface RoomBedPatient {
  id: string;
  firstName: string;
  lastName: string;
}

interface RoomBed {
  id: string;
  bedNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  admissions: { id: string; patient: RoomBedPatient }[];
}

interface RoomWithBeds {
  id: string;
  roomNumber: string;
  floor: number;
  type: string;
  isAmbulatory: boolean;
  beds: RoomBed[];
}

// --- Bed Card (room map) ------------------------------------------------------

function AdmissionBedCard({
  bed,
  onOccupiedClick,
}: {
  bed: RoomBed;
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

// --- Helpers -----------------------------------------------------------------

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

// --- Main Component -----------------------------------------------------------

const CAN_MANAGE_ROLES = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE'];

export default function AdmissionsPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();

  const canManage = CAN_MANAGE_ROLES.includes(session?.user?.role ?? '');
  const canDispense = ['ADMIN', 'HEAD_DOCTOR', 'HEAD_NURSE', 'NURSE'].includes(session?.user?.role ?? '');

  // -- List state --
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [recentDischarged, setRecentDischarged] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Room map state --
  const [rooms, setRooms] = useState<RoomWithBeds[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Expiry medicines (floor=3)
  const [expiryMeds, setExpiryMeds] = useState<{id:string;name:string;expiryDate:string;quantity:number}[]>([]);
  useEffect(() => {
    fetch('/api/medicines?floor=3&expiringSoon=true&writtenOff=false')
      .then(r => r.json())
      .then(d => setExpiryMeds(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // -- Add Admission Modal --
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

  // -- Discharge Modal --
  const [dischargeAdmission, setDischargeAdmission] = useState<Admission | null>(null);
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [dischargeSaving, setDischargeSaving] = useState(false);
  const [dischargeError, setDischargeError] = useState<string | null>(null);
  const [dischargeResult, setDischargeResult] = useState<DischargeResult | null>(null);

  // -- Dori berish modal (floor=3) -------------------------------------------
  const [showMedModal, setShowMedModal] = useState(false);
  const [medAdmission, setMedAdmission] = useState<Admission | null>(null);
  const [statMeds, setStatMeds] = useState<MedOption[]>([]);
  const [statMedsLoading, setStatMedsLoading] = useState(false);
  const [selMedId, setSelMedId] = useState('');
  const [medQty, setMedQty] = useState('1');
  const [medSaving, setMedSaving] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);

  useEffect(() => {
    if (!showMedModal) return;
    setStatMedsLoading(true);
    fetch('/api/medicines?floor=3&writtenOff=false')
      .then(r => r.json())
      .then(d => setStatMeds(Array.isArray(d) ? d : []))
      .catch(() => setStatMeds([]))
      .finally(() => setStatMedsLoading(false));
  }, [showMedModal]);

  function openMedModal(adm: Admission) {
    setMedAdmission(adm);
    setSelMedId('');
    setMedQty('1');
    setMedError(null);
    setShowMedModal(true);
  }

  async function handleMedDispense(e: React.FormEvent) {
    e.preventDefault();
    if (!medAdmission || !selMedId) return;
    setMedSaving(true);
    setMedError(null);
    try {
      const res = await fetch('/api/medicine-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineId: selMedId,
          type: 'OUT',
          quantity: Number(medQty),
          patientId: medAdmission.patient.id,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || t.common.error); }
      setShowMedModal(false);
    } catch (err) {
      setMedError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setMedSaving(false);
    }
  }

  // --- Fetch admissions ------------------------------------------------------

  const fetchAdmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch('/api/admissions?status=ACTIVE&admissionType=INPATIENT&limit=50'),
        fetch('/api/admissions?status=DISCHARGED&admissionType=INPATIENT&limit=10'),
      ]);
      if (!activeRes.ok) throw new Error(t.common.error);
      const activeJson = await activeRes.json();
      setAdmissions(activeJson.data ?? activeJson);
      if (historyRes.ok) {
        const histJson = await historyRes.json();
        setRecentDischarged(histJson.data ?? histJson);
      }
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await fetch('/api/rooms?isAmbulatory=false&floor=4&include=beds');
      if (!res.ok) return;
      const json = await res.json();
      setRooms(Array.isArray(json) ? json : (json.data ?? []));
    } catch { /* ignore */ } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmissions();
    fetchRooms();
  }, [fetchAdmissions, fetchRooms]);

  // --- Patient search --------------------------------------------------------

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

  // --- Load beds & doctors when modal opens ---------------------------------

  useEffect(() => {
    if (!showAddModal) return;

    (async () => {
      setBedLoading(true);
      try {
        const res = await fetch('/api/beds?status=AVAILABLE&floor=4&ambulatory=false');
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

  // --- Open / reset add modal -----------------------------------------------

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

  // --- Submit new admission -------------------------------------------------

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
      if (diagnosis.trim()) body.notes = diagnosis.trim();
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
      fetchRooms();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setAddSaving(false);
    }
  };

  // --- Discharge ------------------------------------------------------------

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
      fetchRooms();
    } catch (err) {
      setDischargeError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDischargeSaving(false);
    }
  };

  // --- Render ---------------------------------------------------------------

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

      {/* Expiry alert for floor=3 medicines */}
      {expiryMeds.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-orange-800 mb-2">⚠️ 3-qavat dorilar — muddati tugayotgan ({expiryMeds.length} ta):</p>
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
          <Building2 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-700">Xona xaritasi</h2>
          {roomsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>
        {rooms.length === 0 && !roomsLoading ? (
          <div className="text-center py-6 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
            {t.rooms.noRooms}
          </div>
        ) : (
          (() => {
            const floors = [...new Set(rooms.map(r => r.floor))].sort();
            return (
              <div className="space-y-4">
                {floors.map(floor => {
                  const floorRooms = rooms.filter(r => r.floor === floor);
                  return (
                    <div key={floor}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        {floorLabel(floor)}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {floorRooms.map(room => {
                          const avail = room.beds.filter(b => b.status === 'AVAILABLE').length;
                          const occ = room.beds.filter(b => b.status === 'OCCUPIED').length;
                          return (
                            <div
                              key={room.id}
                              className="bg-white rounded-xl border border-slate-200 p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-sm font-semibold text-slate-800">
                                    {t.rooms.number} {room.roomNumber}
                                  </span>
                                </div>
                                <span className="text-[10px] font-medium bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
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
                                    <AdmissionBedCard
                                      key={bed.id}
                                      bed={bed}
                                      onOccupiedClick={(patientId) =>
                                        router.push(`/patients/${patientId}?tab=nurse`)
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
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>

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
                        {floorLabel(adm.bed.room.floor)}
                      </span>
                    </td>
                    {/* Admitted at */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(adm.admissionDate)}
                    </td>
                    {/* Diagnosis */}
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                      {adm.notes ?? '—'}
                    </td>
                    {/* Daily rate */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {adm.dailyRate > 0 ? formatCurrency(adm.dailyRate, t.common.sum) : '—'}
                    </td>
                    {/* Status badge */}
                    <td className="px-4 py-3">
                      {!adm.dischargeDate ? (
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
                      {!adm.dischargeDate && (
                        <div className="flex items-center justify-end gap-1.5">
                          {canDispense && (
                            <button
                              onClick={() => openMedModal(adm)}
                              className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Pill className="w-3.5 h-3.5" />
                              Dori
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => openDischarge(adm)}
                              className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              {t.admissions.discharge}
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

      {/* Recently discharged history */}
      {recentDischarged.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            So&apos;nggi chiqarilganlar
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-500">Bemor</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-500">Xona / To&apos;shak</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-500">Yotqizilgan</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-500">Chiqarilgan</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-500">Kunlik narx</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDischarged.map(adm => (
                    <tr key={adm.id} className="border-b border-slate-100 hover:bg-slate-50 text-slate-600">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {adm.patient.lastName} {adm.patient.firstName} {adm.patient.fatherName}
                      </td>
                      <td className="px-4 py-3">
                        Xona {adm.bed.room.roomNumber} / To&apos;shak {adm.bed.bedNumber}
                        <span className="block text-xs text-slate-400">{floorLabel(adm.bed.room.floor)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(adm.admissionDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {adm.dischargeDate ? formatDate(adm.dischargeDate) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {adm.dailyRate > 0 ? formatCurrency(adm.dailyRate, t.common.sum) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -- Add Admission Modal ---------------------------------------------- */}
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
                        {t.admissions.room} {b.room.roomNumber} — {t.admissions.bed} {b.bedNumber} ({floorLabel(b.room.floor)})
                      </option>
                    ))}
                  </select>
                )}
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

      {/* -- Discharge Modal -------------------------------------------------- */}
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
                  {t.admissions.admittedAt}: {formatDate(dischargeAdmission.admissionDate)}
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

      {/* -- Dori berish Modal (floor=3) --------------------------------------- */}
      {showMedModal && medAdmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Pill className="w-5 h-5 text-teal-600" />
                Dori berish — 3-qavat shkafi
              </h2>
              <button
                onClick={() => setShowMedModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMedDispense} className="p-6 space-y-4">
              {/* Patient info */}
              <div className="bg-slate-50 rounded-lg px-4 py-2.5 text-sm">
                <span className="text-slate-500">Bemor: </span>
                <span className="font-medium text-slate-800">
                  {medAdmission.patient.lastName} {medAdmission.patient.firstName} {medAdmission.patient.fatherName}
                </span>
              </div>

              {medError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{medError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Dori <span className="text-red-500">*</span></label>
                {statMedsLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
                  </div>
                ) : (
                  <select
                    value={selMedId}
                    onChange={e => setSelMedId(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">— Dorini tanlang —</option>
                    {statMeds.filter(m => m.quantity > 0).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.type}) — zaxira: {m.quantity} | {Number(m.price).toLocaleString()} so&apos;m
                      </option>
                    ))}
                  </select>
                )}
                {statMeds.length === 0 && !statMedsLoading && (
                  <p className="text-xs text-orange-500">3-qavat shkafida dori mavjud emas</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Miqdor <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={1}
                  value={medQty}
                  onChange={e => setMedQty(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {selMedId && (() => {
                const med = statMeds.find(m => m.id === selMedId);
                if (!med) return null;
                return (
                  <div className="bg-teal-50 border border-teal-100 rounded-lg px-4 py-2.5 text-sm text-teal-800">
                    Jami: <span className="font-semibold">{(Number(med.price) * Number(medQty || 0)).toLocaleString()} so&apos;m</span>
                    <span className="text-teal-500 ml-2 text-xs">(bemor profilidagi Xizmatlar bo&apos;limiga qo&apos;shiladi)</span>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={medSaving || !selMedId}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {medSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pill className="w-4 h-4" />}
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
