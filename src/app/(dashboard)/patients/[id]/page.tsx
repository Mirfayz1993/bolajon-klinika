'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { printQr, printReceipt } from './_lib/print-templates';
import { Modal } from './_components/ui';
import { InfoTab } from './_components/InfoTab';
import { ServicesTab } from './_components/ServicesTab';
import { RecordsTab } from './_components/RecordsTab';
import { NurseTab } from './_components/NurseTab';
import { LabTab } from './_components/LabTab';
import { InpatientTab } from './_components/InpatientTab';
import { MedicalRecordModal } from './_components/modals/MedicalRecordModal';
import { NurseNoteModal } from './_components/modals/NurseNoteModal';
import { LabOrderModal } from './_components/modals/LabOrderModal';
import { PayModal } from './_components/modals/PayModal';
import { BulkPayModal } from './_components/modals/BulkPayModal';
import { AssignServiceModal } from './_components/modals/AssignServiceModal';
import {
  ArrowLeft, Pencil, Trash2, Check, X, Loader2, AlertCircle,
  User, Phone, MapPin,
  Hash, Printer,
  Stethoscope, CreditCard, FlaskConical, BedDouble, ClipboardList, QrCode,
} from 'lucide-react';

// --- Types --------------------------------------------------------------------

interface Patient {
  id: string; firstName: string; lastName: string; fatherName: string;
  phone: string; jshshir: string; birthDate: string;
  district: string | null; houseNumber: string | null;
  medicalHistory: string | null; allergies: string | null;
  chronicConditions: string | null;
  telegramChatId: string | null; createdAt: string; updatedAt: string;
}

interface EditForm {
  firstName: string; lastName: string; fatherName: string;
  phone: string; jshshir: string; birthDate: string;
  district: string; houseNumber: string; medicalHistory: string;
  allergies: string; chronicConditions: string; telegramChatId: string;
}

interface Prescription {
  id: string; medicineName: string; dosage: string;
  duration: string; instructions?: string; createdAt: string;
}

interface MedicalRecord {
  id: string; diagnosis?: string; treatment?: string; notes?: string;
  createdAt: string;
  doctor: { name: string; role: string; specialization?: { name: string } | null };
  prescriptions: Prescription[];
}

interface Payment {
  id: string; amount: number; method: string; category: string;
  status: string; createdAt: string;
  appointment?: { type: string; dateTime: string } | null;
  admission?: { admissionType: string; admissionDate: string } | null;
}

interface LabTest {
  id: string; status: string; results: Record<string, unknown> | null;
  notes?: string | null; completedAt?: string | null; createdAt: string;
  testType: { name: string; unit?: string | null; normalRange?: string | null; price: number };
  labTech: { name: string; role: string };
  payment?: { id: string; status: string } | null;
}

interface Admission {
  id: string; admissionType: string; admissionDate: string; status: string;
  dischargeDate?: string | null; dailyRate: number; notes?: string | null;
  bed: { bedNumber: string; room: { floor: number; roomNumber: string; type: string } };
}

interface Appointment {
  id: string; type: string; status: string; dateTime: string; notes?: string | null;
  doctor: { name: string; role: string; specialization?: { name: string } | null };
}

interface NurseNote {
  id: string; procedure: string; notes?: string | null;
  medicines?: { name: string; quantity: number; unit: string }[] | null;
  noteType?: string | null;
  createdAt: string;
  nurse: { name: string; role: string };
  admission?: {
    bed: { bedNumber: string; room: { floor: number; roomNumber: string } };
  } | null;
}

interface AssignedService {
  id: string;
  categoryName: string;
  itemName: string;
  price: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentId: string | null;
  assignedAt: string;
  assignedBy: { name: string; role: string };
  doctor?: { name: string; role: string } | null;
  admission?: { bed: { bedNumber: string; room: { roomNumber: string; floor: number } } | null } | null;
}

interface ProfileData {
  patient: Patient; medicalRecords: MedicalRecord[];
  payments: Payment[]; labTests: LabTest[];
  admissions: Admission[]; appointments: Appointment[];
  nurseNotes: NurseNote[];
}

// --- Helpers ------------------------------------------------------------------

function calcAge(birthDate: string): number {
  const today = new Date(); const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('uz-UZ');
}

function fmtMoney(amount: number) {
  return amount.toLocaleString('uz-UZ') + ' so\'m';
}

const CAT_LABELS: Record<string, string> = {
  CHECKUP: 'Shifokor ko\'rigi', LAB_TEST: 'Laboratoriya', SPEECH_THERAPY: 'Logoped',
  MASSAGE: 'Massaj', TREATMENT: 'Muolaja (ukol)', INPATIENT: 'Statsionar',
  AMBULATORY: 'Ambulator',
};

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800', PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIAL: 'bg-orange-100 text-orange-800', CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-blue-100 text-blue-800',
};

const APPT_TYPE_LABELS: Record<string, string> = {
  CHECKUP: 'Ko\'rik', FOLLOW_UP: 'Qayta ko\'rik', SPEECH_THERAPY: 'Logoped',
  MASSAGE: 'Massaj', LAB_TEST: 'Laboratoriya',
};

const APPT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800', IN_QUEUE: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800', COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800', NO_SHOW: 'bg-slate-100 text-slate-700',
};

// --- Page ---------------------------------------------------------------------

type Tab = 'info' | 'services' | 'records' | 'nurse' | 'lab' | 'inpatient';

interface PageProps { params: Promise<{ id: string }> }

export default function PatientDetailPage({ params }: PageProps) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [patientId, setPatientId] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    return (tab as Tab) ?? 'info';
  });
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit patient
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // QR
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Timeline
  type TimelineEvent = { id: string; time: string; type: string; title: string; detail?: string; color: string };
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Medical record modal
  const [showRecordModal, setShowRecordModal] = useState(false);

  // Nurse note modal
  const [showNurseModal, setShowNurseModal] = useState(false);

  const { can, isAdmin } = usePermissions();
  const canSeePrices = can('/patients:see_prices');
  const canManageServices = can('/patients:manage_services');
  const isNurse = can('/patients:tab:hamshira');
  const isDoctor = can('/patients:tab:tashxislar');
  const canOrderLabTest = can('/patients:order_lab');
  const canPrintQr = can('/patients:print_qr');

  // Assigned services
  const [assignedServices, setAssignedServices] = useState<AssignedService[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  // To'lov modal (single)
  const [showPayModal, setShowPayModal] = useState(false);
  const [payModalService, setPayModalService] = useState<AssignedService | null>(null);
  // Bulk to'lov
  const [selectedForPay, setSelectedForPay] = useState<Set<string>>(new Set());
  const [showBulkPayModal, setShowBulkPayModal] = useState(false);
  const [bulkPaying, setBulkPaying] = useState(false);

  useEffect(() => {
    params.then(({ id }) => setPatientId(id));
  }, [params]);

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab | null;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const fromQueue = searchParams.get('from') === 'queue';
  const fromAmbulatory = searchParams.get('from') === 'ambulatory';
  const urlNoteType = searchParams.get('noteType') ?? '';

  const fetchProfile = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}/profile`);
      if (!res.ok) throw new Error('Xatolik');
      setProfile(await res.json());
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [patientId, t.common.error]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const fetchTimeline = useCallback(async () => {
    if (!patientId) return;
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/timeline`);
      if (res.ok) {
        const d = await res.json();
        setTimeline(d.events ?? []);
      }
    } finally { setTimelineLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  // Active admission (used for inpatient tab visibility + as prop to InpatientTab)
  const activeAdmission = profile?.admissions.find(a => !a.dischargeDate) ?? null;

  const fetchAssigned = useCallback(async () => {
    if (!patientId) return;
    setAssignedLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/assigned-services`);
      if (res.ok) setAssignedServices(await res.json());
    } finally { setAssignedLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchAssigned(); }, [fetchAssigned]);

  // Lab order modal trigger (state lives inside LabOrderModal)
  const [showPatientLabOrderModal, setShowPatientLabOrderModal] = useState(false);

  // NOTE: Stage 5c — xizmat tayinlash modal va u bilan bog'liq state/useEffect/save logikasi
  // `_components/modals/AssignServiceModal.tsx` ga ko'chirildi. Bu yerda faqat
  // `showAssignModal` trigger va `fetchAssigned` callback qoldi.

  const deleteAssigned = async (id: string) => {
    if (!confirm('Xizmatni o\'chirasizmi?')) return;
    await fetch(`/api/patients/${patientId}/assigned-services`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: id }),
    });
    fetchAssigned();
  };

  const openPayModal = (svc: AssignedService) => {
    setPayModalService(svc);
    setShowPayModal(true);
  };

  const confirmPay = async (method: string) => {
    if (!payModalService) return;
    setPayingId(payModalService.id);
    try {
      const res = await fetch(`/api/patients/${patientId}/assigned-services/${payModalService.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      setShowPayModal(false);
      setPayModalService(null);
      await fetchAssigned();
      await fetchProfile();
      handlePrintReceipt([payModalService.id]);
    } finally { setPayingId(null); }
  };

  // -- Edit ------------------------------------------------------------------
  const startEdit = () => {
    if (!profile) return;
    const p = profile.patient;
    setEditForm({
      firstName: p.firstName, lastName: p.lastName, fatherName: p.fatherName,
      phone: p.phone, jshshir: p.jshshir ?? '',
      birthDate: new Date(p.birthDate).getFullYear().toString(),
      district: p.district ?? '', houseNumber: p.houseNumber ?? '',
      medicalHistory: p.medicalHistory ?? '',
      allergies: p.allergies ?? '', chronicConditions: p.chronicConditions ?? '',
      telegramChatId: p.telegramChatId ?? '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, birthDate: editForm.birthDate?.length === 4 ? `${editForm.birthDate}-01-01` : (editForm.birthDate || undefined) }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setEditing(false);
      fetchProfile();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.common.error);
    } finally { setSaving(false); }
  };

  // -- QR --------------------------------------------------------------------
  const openQr = async () => {
    setShowQr(true);
    if (qrDataUrl) return;
    setQrLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/qr`);
      if (res.ok) { const j = await res.json(); setQrDataUrl(j.dataUrl); }
    } finally { setQrLoading(false); }
  };

  // -- Bulk pay --------------------------------------------------------------
  const toggleSelectForPay = (id: string) => {
    setSelectedForPay(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllUnpaid = () => {
    const unpaidIds = assignedServices.filter(s => !s.isPaid).map(s => s.id);
    setSelectedForPay(new Set(unpaidIds));
  };

  const bulkPay = async (method: string) => {
    if (selectedForPay.size === 0) return;
    setBulkPaying(true);
    try {
      const ids = Array.from(selectedForPay);
      await Promise.all(ids.map(id =>
        fetch(`/api/patients/${patientId}/assigned-services/${id}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method }),
        })
      ));
      setShowBulkPayModal(false);
      const paidIds = Array.from(selectedForPay);
      setSelectedForPay(new Set());
      await fetchAssigned();
      await fetchProfile();
      handlePrintReceipt(paidIds);
    } finally { setBulkPaying(false); }
  };

  // -- Print receipt ---------------------------------------------------------
  const handlePrintReceipt = (justPaidIds?: string[]) => {
    if (!profile) return;
    return printReceipt({
      patient: profile.patient,
      qrDataUrl,
      setQrDataUrl,
      assignedServices,
      nurseNotes: profile.nurseNotes ?? [],
      justPaidIds,
      canSeePrices,
      patientId,
    });
  };

  // -- Delete patient ---------------------------------------------------------
  const handleDelete = async () => {
    if (!confirm(t.patients.deleteConfirm)) return;
    const res = await fetch(`/api/patients/${patientId}`, { method: 'DELETE' });
    if (res.ok) router.push('/patients');
  };

  // -------------------------------------------------------------------------
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  if (error || !profile) return (
    <div className="p-6">
      <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <AlertCircle className="w-4 h-4" /> {error || 'Bemor topilmadi'}
      </div>
    </div>
  );

  const { patient, medicalRecords, payments, labTests, admissions, appointments, nurseNotes } = profile;
  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);

  const pt = t.patients as typeof t.patients & {
    tabs: { general: string; services: string; records: string; nurse: string; lab: string };
    fields: { fullName: string; birthYear: string; phone: string; district: string; age: string; registered: string; totalPayment: string; operations: string };
    sections: { services: string; records: string; nurseNotes: string; labTests: string; payments: string; admissions: string; appointments: string };
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number; requires?: string }[] = [
    { key: 'info' as Tab, label: pt.tabs?.general ?? 'Umumiy', icon: <User className="w-4 h-4" /> },
    { key: 'services' as Tab, label: pt.tabs?.services ?? 'Xizmatlar', icon: <CreditCard className="w-4 h-4" />, count: assignedServices.length, requires: '/patients:tab:xizmatlar' },
    { key: 'records' as Tab, label: pt.tabs?.records ?? 'Tashxislar', icon: <Stethoscope className="w-4 h-4" />, count: medicalRecords.length, requires: '/patients:tab:tashxislar' },
    { key: 'nurse' as Tab, label: pt.tabs?.nurse ?? 'Hamshira', icon: <ClipboardList className="w-4 h-4" />, count: nurseNotes.length, requires: '/patients:tab:hamshira' },
    { key: 'lab' as Tab, label: pt.tabs?.lab ?? 'Laboratoriya', icon: <FlaskConical className="w-4 h-4" />, count: labTests.length, requires: '/patients:tab:laboratoriya' },
    ...(activeAdmission ? [{ key: 'inpatient' as Tab, label: 'Statsionar', icon: <BedDouble className="w-4 h-4" />, requires: '/patients:tab:statsionar' }] : []),
  ].filter(tab => !tab.requires || can(tab.requires));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/patients')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm">
          <ArrowLeft className="w-4 h-4" /> {t.common.back}
        </button>
        <div className="flex items-center gap-2">
          {fromQueue && (
            <button
              onClick={() => router.push('/doctor-queue')}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <ArrowLeft className="w-4 h-4" /> Navbatga qaytish
            </button>
          )}
          {fromAmbulatory && (
            <button
              onClick={() => router.push('/ambulatory')}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <ArrowLeft className="w-4 h-4" /> Ambulatoryaga qaytish
            </button>
          )}
          <button onClick={openQr}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
            <QrCode className="w-4 h-4" /> QR
          </button>
          <button onClick={startEdit}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
            <Pencil className="w-4 h-4" /> {t.common.edit}
          </button>
          {isAdmin && (
            <button onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 text-red-600">
              <Trash2 className="w-4 h-4" /> {t.common.delete}
            </button>
          )}
        </div>
      </div>

      {/* Patient card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">
              {patient.lastName} {patient.firstName} {patient.fatherName}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {calcAge(patient.birthDate)} {pt.fields?.age ?? 'yosh'} • {pt.fields?.registered ?? "Ro'yxatdan o'tgan"}: {fmtDate(patient.createdAt)}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{patient.phone}</span>
              {patient.jshshir && <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />{patient.jshshir}</span>}
              {patient.district && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{patient.district}</span>}
            </div>
          </div>
          {canSeePrices && (
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-slate-500">{pt.fields?.totalPayment ?? "Jami to'lov"}</div>
              <div className="text-lg font-bold text-green-700">{fmtMoney(totalPaid)}</div>
              <div className="text-xs text-slate-400 mt-0.5">{payments.length} {pt.fields?.operations ?? 'ta operatsiya'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab.icon} {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* -- TAB: UMUMIY ---------------------------------------------------- */}
      {activeTab === 'info' && (
        <InfoTab
          patient={patient}
          admissions={admissions}
          timeline={timeline}
          timelineLoading={timelineLoading}
          pt={pt}
          fmtDate={fmtDate}
          calcAge={calcAge}
        />
      )}

      {/* -- TAB: XIZMATLAR ------------------------------------------------- */}
      {activeTab === 'services' && (
        <ServicesTab
          assignedServices={assignedServices}
          assignedLoading={assignedLoading}
          appointments={appointments}
          nurseNotes={nurseNotes}
          selectedForPay={selectedForPay}
          toggleSelectForPay={toggleSelectForPay}
          selectAllUnpaid={selectAllUnpaid}
          canSeePrices={canSeePrices}
          canManageServices={canManageServices}
          onAssignClick={() => setShowAssignModal(true)}
          onPayClick={openPayModal}
          onDelete={deleteAssigned}
          onPrintReceipt={handlePrintReceipt}
          onBulkPay={() => setShowBulkPayModal(true)}
          fmtMoney={fmtMoney}
          fmtDate={fmtDate}
          fmt={fmt}
          apptTypeLabels={APPT_TYPE_LABELS}
          apptStatusColors={APPT_STATUS_COLORS}
        />
      )}

      {/* -- PAY MODAL ----------------------------------------------------- */}
      <PayModal
        open={showPayModal}
        service={payModalService}
        onClose={() => setShowPayModal(false)}
        onConfirm={confirmPay}
        paying={!!payingId}
        fmtMoney={fmtMoney}
        canSeePrices={canSeePrices}
      />

      {/* -- BULK PAY MODAL ------------------------------------------------ */}
      <BulkPayModal
        open={showBulkPayModal}
        count={selectedForPay.size}
        total={assignedServices.filter(s => selectedForPay.has(s.id)).reduce((sum, s) => sum + Number(s.price), 0)}
        services={assignedServices.filter(s => selectedForPay.has(s.id))}
        onClose={() => setShowBulkPayModal(false)}
        onConfirm={bulkPay}
        paying={bulkPaying}
        fmtMoney={fmtMoney}
        canSeePrices={canSeePrices}
      />


      {/* -- ASSIGN SERVICE MODAL ------------------------------------------- */}
      <AssignServiceModal
        open={showAssignModal}
        patientId={patientId}
        patient={patient}
        profile={profile}
        canSeePrices={canSeePrices}
        onClose={() => setShowAssignModal(false)}
        onSaved={fetchAssigned}
      />

      {/* -- TAB: TASHXISLAR ------------------------------------------------ */}
      {activeTab === 'records' && (
        <RecordsTab
          records={medicalRecords}
          isDoctor={isDoctor}
          onAddClick={() => setShowRecordModal(true)}
          fmt={fmt}
        />
      )}

      {/* -- TAB: HAMSHIRA QAYDLARI ------------------------------------------ */}
      {activeTab === 'nurse' && (
        <NurseTab
          nurseNotes={nurseNotes}
          isNurse={isNurse}
          urlNoteType={urlNoteType}
          onAddClick={() => setShowNurseModal(true)}
          fmt={fmt}
        />
      )}

      {/* -- TAB: LABORATORIYA ----------------------------------------------- */}
      {activeTab === 'lab' && (
        <LabTab
          labTests={labTests}
          patientId={patientId}
          canOrderLabTest={canOrderLabTest}
          onOpenOrderModal={() => setShowPatientLabOrderModal(true)}
          fmt={fmt}
          router={router}
        />
      )}

      {/* -- TAB: STATSIONAR ------------------------------------------------- */}
      {activeTab === 'inpatient' && activeAdmission && (
        <InpatientTab
          activeAdmission={activeAdmission}
          isDoctor={isDoctor}
          isNurse={isNurse}
          canSeePrices={canSeePrices}
          fmt={fmt}
          fmtMoney={fmtMoney}
        />
      )}

      {/* -- Lab Order Modal ------------------------------------------------- */}
      <LabOrderModal
        open={showPatientLabOrderModal}
        patient={patient}
        canSeePrices={canSeePrices}
        onClose={() => setShowPatientLabOrderModal(false)}
      />

      {/* -- QR Modal -------------------------------------------------------- */}
      {showQr && (
        <Modal title="Bemor QR Kodi" onClose={() => setShowQr(false)}>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrLoading ? <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              : qrDataUrl
                ? <img src={qrDataUrl} alt="QR" className="w-52 h-52 rounded-xl" />
                : <div className="text-slate-500 text-sm">QR yuklanmadi</div>
            }
            <p className="text-sm text-slate-600 text-center">
              {patient.lastName} {patient.firstName}<br />
              <span className="text-slate-400 text-xs">{patient.phone}</span>
            </p>
            {canPrintQr && (
              <button onClick={() => profile && printQr({ patient: profile.patient, qrDataUrl })} disabled={!qrDataUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                <Printer className="w-4 h-4" /> Chop etish
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* -- Edit Modal ------------------------------------------------------ */}
      {editing && editForm && (
        <Modal title={t.patients.editPatient} onClose={() => setEditing(false)}>
          <div className="grid grid-cols-2 gap-4">
            {([
              ['lastName', 'Familiya'], ['firstName', 'Ism'], ['fatherName', 'Otasining ismi'],
              ['phone', 'Telefon'], ['jshshir', 'JSHSHIR'], ['birthDate', 'Tug\'ilgan yil'],
              ['district', 'Tuman'], ['houseNumber', 'Uy raqami'], ['telegramChatId', 'Telegram Chat ID'],
            ] as [keyof EditForm, string][]).map(([key, label]) => (
              <div key={key} className={key === 'telegramChatId' ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input
                  type="text"
                  maxLength={key === 'birthDate' ? 4 : undefined}
                  placeholder={key === 'birthDate' ? 'YYYY' : undefined}
                  value={editForm[key]}
                  onChange={e => setEditForm(f => f ? { ...f, [key]: e.target.value } : f)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Allergiyalar</label>
              <textarea value={editForm.allergies}
                onChange={e => setEditForm(f => f ? { ...f, allergies: e.target.value } : f)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Surunkali kasalliklar</label>
              <textarea value={editForm.chronicConditions}
                onChange={e => setEditForm(f => f ? { ...f, chronicConditions: e.target.value } : f)}
                rows={2} placeholder="Diabet, gipertoniya, astma..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Tibbiy tarix</label>
              <textarea value={editForm.medicalHistory}
                onChange={e => setEditForm(f => f ? { ...f, medicalHistory: e.target.value } : f)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {saveError && <p className="text-red-600 text-sm mt-3">{saveError}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditing(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              <X className="w-4 h-4 inline mr-1" /> {t.common.cancel}
            </button>
            <button onClick={saveEdit} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t.common.save}
            </button>
          </div>
        </Modal>
      )}

      {/* -- Medical Record Modal -------------------------------------------- */}
      {showRecordModal && (
        <MedicalRecordModal
          patientId={patientId}
          doctorId={session?.user?.id}
          patient={patient}
          onClose={() => setShowRecordModal(false)}
          onSaved={fetchProfile}
        />
      )}

      {/* -- Nurse Note Modal ------------------------------------------------ */}
      {showNurseModal && (
        <NurseNoteModal
          patientId={patientId}
          defaultNoteType={urlNoteType}
          onClose={() => setShowNurseModal(false)}
          onSaved={fetchProfile}
        />
      )}
    </div>
  );
}


