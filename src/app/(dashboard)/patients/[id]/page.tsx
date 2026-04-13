'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
import {
  ArrowLeft, Pencil, Trash2, Check, X, Loader2, AlertCircle,
  User, Phone, Calendar, MapPin, FileText, AlertTriangle,
  MessageCircle, Hash, Plus, Printer, Droplets,
  Stethoscope, CreditCard, FlaskConical, BedDouble, ClipboardList, QrCode,
  Activity,
} from 'lucide-react';

// --- Types --------------------------------------------------------------------

interface Patient {
  id: string; firstName: string; lastName: string; fatherName: string;
  phone: string; jshshir: string; birthDate: string;
  district: string | null; houseNumber: string | null;
  medicalHistory: string | null; allergies: string | null;
  telegramChatId: string | null; createdAt: string; updatedAt: string;
}

interface EditForm {
  firstName: string; lastName: string; fatherName: string;
  phone: string; jshshir: string; birthDate: string;
  district: string; houseNumber: string; medicalHistory: string;
  allergies: string; telegramChatId: string;
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
  id: string; admissionType: string; admissionDate: string;
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
}

interface ServiceCategoryItem {
  id: string;
  name: string;
  price: number;
}

interface ServiceCategoryData {
  id: string;
  name: string;
  items: ServiceCategoryItem[];
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

const LAB_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700', IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-800',
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

type Tab = 'info' | 'services' | 'records' | 'nurse' | 'lab';

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
  const [recordForm, setRecordForm] = useState({
    diagnosis: '',
    treatment: '',
    notes: '',
    prescriptions: [] as { medicineName: string; dosage: string; duration: string; instructions: string }[],
  });
  const [savingRecord, setSavingRecord] = useState(false);

  // Nurse note modal
  const [showNurseModal, setShowNurseModal] = useState(false);
  const [nurseForm, setNurseForm] = useState({
    procedure: '', notes: '', admissionId: '', noteType: '',
    medicines: [] as { name: string; quantity: number; unit: string }[],
  });
  const [savingNote, setSavingNote] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN';
  const canSeePrices = ['ADMIN', 'RECEPTIONIST'].includes(session?.user?.role ?? '');
  const canManageServices = ['ADMIN', 'RECEPTIONIST', 'HEAD_DOCTOR', 'HEAD_NURSE'].includes(
    session?.user?.role ?? ''
  );
  const isNurse = ['ADMIN', 'HEAD_NURSE', 'NURSE', 'HEAD_DOCTOR', 'DOCTOR'].includes(
    session?.user?.role ?? ''
  );
  const isDoctor = ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR'].includes(session?.user?.role ?? '');
  const canOrderLabTest = ['ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'RECEPTIONIST'].includes(session?.user?.role ?? '');

  // Assigned services
  const [assignedServices, setAssignedServices] = useState<AssignedService[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryData[]>([]);
  const [assignCatId, setAssignCatId] = useState('');
  const [assignItemId, setAssignItemId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignDoctorId, setAssignDoctorId] = useState('');
  const [assignIsUrgent, setAssignIsUrgent] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState('');
  const [doctorList, setDoctorList] = useState<{ id: string; name: string; role: string }[]>([]);
  const [allStaffList, setAllStaffList] = useState<{ id: string; name: string; role: string }[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('CASH');
  // To'lov modal (single)
  const [showPayModal, setShowPayModal] = useState(false);
  const [payModalService, setPayModalService] = useState<AssignedService | null>(null);
  // Bulk to'lov
  const [selectedForPay, setSelectedForPay] = useState<Set<string>>(new Set());
  const [showBulkPayModal, setShowBulkPayModal] = useState(false);
  const [bulkPaying, setBulkPaying] = useState(false);
  const [bulkPayMethod, setBulkPayMethod] = useState('CASH');

  useEffect(() => {
    params.then(({ id }) => setPatientId(id));
  }, [params]);

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab | null;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const fromQueue = searchParams.get('from') === 'queue';
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

  const fetchAssigned = useCallback(async () => {
    if (!patientId) return;
    setAssignedLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/assigned-services`);
      if (res.ok) setAssignedServices(await res.json());
    } finally { setAssignedLoading(false); }
  }, [patientId]);

  useEffect(() => { fetchAssigned(); }, [fetchAssigned]);

  const openAssignModal = async () => {
    setShowAssignModal(true);
    if (serviceCategories.length > 0) return;
    try {
      const res = await fetch('/api/service-categories');
      if (res.ok) setServiceCategories(await res.json());
    } catch { /* ignore */ }
  };

  const assignCat = serviceCategories.find(c => c.id === assignCatId);

  // Lab categories: fetch from lab-test-types
  const [labTestTypes, setLabTestTypes] = useState<ServiceCategoryItem[]>([]);
  const isLabCat = assignCat ? ['lab','laboratoriya','labaratoriya','tahlil'].some(k => assignCat.name.toLowerCase().includes(k)) : false;
  const isDoctorCat = assignCat ? ['doktor','ko\'rik','korik','checkup','qabul','shifokor'].some(k => assignCat.name.toLowerCase().includes(k)) : false;
  const isAmbulatoryCat = assignCat ? assignCat.name.toLowerCase().includes('ambulator') : false;

  // Ambulatory room + bed selection
  const [ambRooms, setAmbRooms] = useState<{ id: string; roomNumber: string; floor: number }[]>([]);
  const [ambRoomId, setAmbRoomId] = useState('');
  const [ambBeds, setAmbBeds] = useState<{ id: string; bedNumber: string; status: string }[]>([]);
  const [ambBedId, setAmbBedId] = useState('');
  const [ambBedsLoading, setAmbBedsLoading] = useState(false);

  useEffect(() => {
    if (!isLabCat) return;
    fetch('/api/lab-test-types')
      .then(r => r.json())
      .then(d => setLabTestTypes(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setLabTestTypes([]));
  }, [isLabCat]);

  // Lab order modal (from lab tab)
  interface LabOrderType { id: string; name: string; price: number; category: string | null; }
  const [showPatientLabOrderModal, setShowPatientLabOrderModal] = useState(false);
  const [patientLabAllTypes, setPatientLabAllTypes] = useState<LabOrderType[]>([]);
  const [patientLabSelectedIds, setPatientLabSelectedIds] = useState<string[]>([]);
  const [patientLabOpenGroups, setPatientLabOpenGroups] = useState<Set<string>>(new Set());
  const [patientLabOrderSaving, setPatientLabOrderSaving] = useState(false);
  const [patientLabOrderError, setPatientLabOrderError] = useState<string | null>(null);
  const [patientLabOrderDone, setPatientLabOrderDone] = useState(false);

  function openPatientLabOrderModal() {
    setPatientLabSelectedIds([]);
    setPatientLabOpenGroups(new Set());
    setPatientLabOrderError(null);
    setPatientLabOrderDone(false);
    setShowPatientLabOrderModal(true);
    fetch('/api/lab-test-types')
      .then(r => r.json())
      .then(d => setPatientLabAllTypes(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {});
  }

  async function handlePatientLabOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || patientLabSelectedIds.length === 0) return;
    setPatientLabOrderSaving(true);
    setPatientLabOrderError(null);
    try {
      await Promise.all(
        patientLabSelectedIds.map(id => {
          const tt = patientLabAllTypes.find(x => x.id === id);
          if (!tt) return Promise.resolve();
          return fetch(`/api/patients/${patient.id}/assigned-services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryName: 'Laboratoriya',
              itemName: tt.name,
              price: Number(tt.price),
              itemId: tt.id,
            }),
          });
        })
      );
      setPatientLabOrderDone(true);
    } catch {
      setPatientLabOrderError('Xatolik yuz berdi');
    } finally {
      setPatientLabOrderSaving(false);
    }
  }

  useEffect(() => {
    if (!isDoctorCat) return;
    if (doctorList.length > 0) return;
    fetch('/api/staff?role=DOCTOR&role=HEAD_DOCTOR')
      .then(r => r.json())
      .then(d => setDoctorList((d.data ?? d).filter((u: { isActive: boolean }) => u.isActive)))
      .catch(() => null);
  }, [isDoctorCat, doctorList.length]);

  useEffect(() => {
    if (!showAssignModal || allStaffList.length > 0) return;
    fetch('/api/staff')
      .then(r => r.json())
      .then(d => setAllStaffList((d.data ?? d).filter((u: { isActive: boolean }) => u.isActive)))
      .catch(() => null);
  }, [showAssignModal, allStaffList.length]);

  // Ambulatory rooms
  useEffect(() => {
    if (!isAmbulatoryCat) return;
    if (ambRooms.length > 0) return;
    fetch('/api/rooms?floor=3&isAmbulatory=true')
      .then(r => r.json())
      .then(d => setAmbRooms(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => null);
  }, [isAmbulatoryCat, ambRooms.length]);

  // Ambulatory beds
  useEffect(() => {
    if (!ambRoomId) { setAmbBeds([]); setAmbBedId(''); return; }
    setAmbBedsLoading(true);
    fetch(`/api/rooms/${ambRoomId}/beds?status=AVAILABLE`)
      .then(r => r.json())
      .then(d => { setAmbBeds(Array.isArray(d) ? d : []); })
      .catch(() => setAmbBeds([]))
      .finally(() => setAmbBedsLoading(false));
  }, [ambRoomId]);

  const visibleItems: ServiceCategoryItem[] = isLabCat ? labTestTypes : (assignCat?.items ?? []);
  const assignItem = visibleItems.find(i => i.id === assignItemId);

  const saveAssign = async () => {
    if (!assignCat || !assignItem) return;
    if (isDoctorCat && !assignDoctorId) { alert('Iltimos, doktor tanlang'); return; }
    if (isAmbulatoryCat && !ambBedId) { alert("Iltimos, ambulator to'shak tanlang"); return; }
    setAssignSaving(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/assigned-services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName: assignCat.name,
          itemName: assignItem.name,
          price: assignItem.price,
          itemId: assignItem.id,
          ...(isDoctorCat && assignDoctorId ? { doctorId: assignDoctorId, isUrgent: assignIsUrgent } : {}),
          ...(!isDoctorCat && assignStaffId ? { doctorId: assignStaffId } : {}),
          ...(isAmbulatoryCat && ambBedId ? { bedId: ambBedId } : {}),
        }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      setShowAssignModal(false);
      setAssignCatId(''); setAssignItemId(''); setAssignDoctorId(''); setAssignIsUrgent(false);
      setAssignStaffId(''); setAmbRoomId(''); setAmbBedId(''); setAmbBeds([]);
      fetchAssigned();
    } finally { setAssignSaving(false); }
  };

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
    setPayMethod('CASH');
    setShowPayModal(true);
  };

  const confirmPay = async () => {
    if (!payModalService) return;
    setPayingId(payModalService.id);
    try {
      const res = await fetch(`/api/patients/${patientId}/assigned-services/${payModalService.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: payMethod }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      setShowPayModal(false);
      setPayModalService(null);
      await fetchAssigned();
      await fetchProfile();
      printReceipt([payModalService.id]);
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
      allergies: p.allergies ?? '', telegramChatId: p.telegramChatId ?? '',
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

  const printQr = () => {
    if (!profile || !qrDataUrl) return;
    const p = profile.patient;
    const html = `<html><head><title>QR - ${p.lastName} ${p.firstName}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:20px}
      .name{font-size:18px;font-weight:bold;margin-bottom:4px}
      .info{font-size:13px;color:#666;margin-bottom:16px}
      img{width:220px;height:220px}
      .box{border:2px solid #1e293b;display:inline-block;padding:16px;border-radius:12px}
      </style></head>
      <body>
        <div class="box">
          <div class="name">${p.lastName} ${p.firstName} ${p.fatherName}</div>
          <div class="info">${p.phone} | Tug'ilgan yil: ${new Date(p.birthDate).getFullYear()}</div>
          <img src="${qrDataUrl}" alt="QR"/>
          <div class="info" style="margin-top:8px">Bolajon Klinikasi</div>
        </div>
      </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;height:500px;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 2000);
  };

  // -- Nurse note -------------------------------------------------------------
  const addMedicineRow = () =>
    setNurseForm(f => ({ ...f, medicines: [...f.medicines, { name: '', quantity: 1, unit: 'ml' }] }));

  const updateMedicine = (idx: number, field: string, value: string | number) =>
    setNurseForm(f => ({
      ...f,
      medicines: f.medicines.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }));

  const removeMedicine = (idx: number) =>
    setNurseForm(f => ({ ...f, medicines: f.medicines.filter((_, i) => i !== idx) }));

  const saveRecord = async () => {
    if (!recordForm.diagnosis.trim() && !recordForm.treatment.trim() && !recordForm.notes.trim()) return;
    setSavingRecord(true);
    try {
      const res = await fetch('/api/medical-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId: session?.user?.id,
          diagnosis: recordForm.diagnosis || undefined,
          treatment: recordForm.treatment || undefined,
          notes: recordForm.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const record = await res.json();

      // Prescriptions saqlash
      const rxList = recordForm.prescriptions.filter(rx => rx.medicineName.trim() && rx.dosage.trim() && rx.duration.trim());
      for (const rx of rxList) {
        await fetch(`/api/medical-records/${record.id}/prescriptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rx),
        });
      }

      // Agar prescription bor bo'lsa, print qil
      if (rxList.length > 0 && profile) {
        printPrescriptions(profile.patient, rxList);
      }

      setShowRecordModal(false);
      setRecordForm({ diagnosis: '', treatment: '', notes: '', prescriptions: [] });
      fetchProfile();
    } catch { /* ignore */ } finally {
      setSavingRecord(false);
    }
  };

  const saveNurseNote = async () => {
    if (!nurseForm.procedure.trim()) return;
    setSavingNote(true);
    try {
      const body: Record<string, unknown> = { procedure: nurseForm.procedure, notes: nurseForm.notes };
      if (nurseForm.admissionId) body.admissionId = nurseForm.admissionId;
      if (nurseForm.medicines.length) body.medicines = nurseForm.medicines.filter(m => m.name.trim());
      if (nurseForm.noteType) body.noteType = nurseForm.noteType;
      const res = await fetch(`/api/patients/${patientId}/nurse-notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setShowNurseModal(false);
      setNurseForm({ procedure: '', notes: '', admissionId: '', noteType: '', medicines: [] });
      fetchProfile();
    } finally { setSavingNote(false); }
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

  const bulkPay = async () => {
    if (selectedForPay.size === 0) return;
    setBulkPaying(true);
    try {
      const ids = Array.from(selectedForPay);
      await Promise.all(ids.map(id =>
        fetch(`/api/patients/${patientId}/assigned-services/${id}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: bulkPayMethod }),
        })
      ));
      setShowBulkPayModal(false);
      const paidIds = Array.from(selectedForPay);
      setSelectedForPay(new Set());
      await fetchAssigned();
      await fetchProfile();
      printReceipt(paidIds);
    } finally { setBulkPaying(false); }
  };

  // -- Print receipt ---------------------------------------------------------
  const printReceipt = async (justPaidIds?: string[]) => {
    if (!profile) return;
    const p = profile.patient;

    // Oynani SYNC ochib olamiz (popup bloker oldini olish)
    const win = window.open('', '_blank', 'width=440,height=720');
    if (!win) { alert("Popup bloklangan. Brauzer sozlamalaridan ruxsat bering."); return; }
    win.document.write('<html><body style="font-family:sans-serif;text-align:center;padding:20px">⏳ Yuklanmoqda...</body></html>');

    // Ensure QR is loaded
    let qr = qrDataUrl;
    if (!qr) {
      const r = await fetch(`/api/patients/${patientId}/qr`);
      if (r.ok) { const j = await r.json(); qr = j.dataUrl; setQrDataUrl(j.dataUrl); }
    }

    // Klinika logotipi — server dan base64 olamiz (print uchun ishonchli)
    let logoDataUrl = '';
    try {
      const logoRes = await fetch('/api/clinic-logo');
      if (logoRes.ok) { const j = await logoRes.json(); logoDataUrl = j.dataUrl ?? ''; }
    } catch { /* fallback: logosiz */ }

    // justPaidIds berilsa — faqat shular; aks holda barcha to'langan
    const paid = justPaidIds
      ? assignedServices.filter(s => justPaidIds.includes(s.id))
      : assignedServices.filter(s => s.isPaid);
    const unpaid = assignedServices.filter(s => !s.isPaid && !(justPaidIds?.includes(s.id)));

    // Medicines from nurse notes
    const allMedicines: { name: string; quantity: number; unit: string; date: string }[] = [];
    if (profile) {
      for (const note of profile.nurseNotes ?? []) {
        if (Array.isArray(note.medicines)) {
          for (const m of note.medicines as { name: string; quantity: number; unit: string }[]) {
            allMedicines.push({ ...m, date: note.createdAt });
          }
        }
      }
    }

    const totalPaidAmt = paid.reduce((s, sv) => s + Number(sv.price), 0);
    const fmtM = (n: number) => n.toLocaleString('uz-UZ') + " so'm";
    const fmtD = (d: string) => new Date(d).toLocaleDateString('uz-UZ');

    const paidRows = paid.map(sv => {
      // Faqat shifokor xizmatlarida "Doktor: To'liq Ism" ko'rsatiladi
      const doctorName = sv.doctor?.name ?? '';
      return `<tr>
        <td colspan="2" style="padding:7px 8px;border-bottom:1px dashed #aaa;">
          <div style="font-weight:900;font-size:14px;">${sv.categoryName}</div>
          <div style="font-weight:900;font-size:14px;margin-top:1px;">${sv.itemName}</div>
          ${doctorName ? `<div style="font-size:13px;font-weight:bold;margin-top:3px;">Doktor: ${doctorName}</div>` : ''}
        </td>
      </tr>`;
    }).join('');

    const unpaidRows = unpaid.map(sv =>
      `<tr>
        <td style="padding:5px 8px;">
          ${sv.categoryName} — ${sv.itemName}
        </td>
        <td style="padding:5px 8px;text-align:right;">${fmtM(Number(sv.price))}</td>
      </tr>`
    ).join('');

    const medicineRows = allMedicines.map(m =>
      `<tr>
        <td style="padding:5px 8px;">
          ${m.name} x ${m.quantity} ${m.unit}
        </td>
        <td style="padding:5px 8px;text-align:right;font-size:11px;">${fmtD(m.date)}</td>
      </tr>`
    ).join('');

    const reminderSection = (unpaid.length > 0 || allMedicines.length > 0) ? `
      <tr><td colspan="2" style="height:12px;"></td></tr>
      <tr><td colspan="2" style="padding:6px 8px;font-size:11px;font-weight:bold;border-top:2px dashed #000;border-bottom:1px solid #000;">
        ESLATMA — Tolanmagan xizmatlar
      </td></tr>
      ${unpaidRows}
      ${allMedicines.length > 0 ? `
        <tr><td colspan="2" style="padding:4px 8px;font-size:11px;font-weight:bold;border-top:1px solid #000;">
          Belgilangan dorilar
        </td></tr>
        ${medicineRows}
      ` : ''}
    ` : '';

    win.document.open();
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>Chek — ${p.lastName} ${p.firstName}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;color:#000!important;background:transparent!important}
        img{background:#fff!important}
        body{font-family:'Times New Roman',Times,serif;font-size:16px;font-weight:bold;background:#fff!important;padding:0}
        .wrap{max-width:380px;margin:0 auto;padding:12px}
        .header{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:2px solid #000;margin-bottom:10px}
        .header-logo{width:52px;height:52px;object-fit:contain;flex-shrink:0}
        .header-text{flex:1}
        .logo{font-size:20px;font-weight:900;letter-spacing:1px}
        .sub{font-size:14px;font-weight:bold}
        .patient{border:1px solid #000;padding:8px 10px;margin-top:10px;margin-bottom:10px}
        .patient .name{font-weight:900;font-size:17px}
        .patient .info{font-size:15px;font-weight:bold;margin-top:3px}
        table{width:100%;border-collapse:collapse;margin-bottom:8px}
        .total-row{border-top:2px solid #000;border-bottom:2px solid #000;font-weight:bold}
        .total-row td{padding:8px!important;font-size:18px;font-weight:900}
        .qr-section{text-align:center;margin-top:12px;padding-top:10px;border-top:2px solid #000}
        .qr-section img{width:160px;height:160px;background:#fff!important;display:block;margin:0 auto;image-rendering:crisp-edges}
        .qr-section .qr-label{font-size:13px;font-weight:bold;margin-top:4px}
        .date{text-align:right;font-size:14px;font-weight:bold;margin-bottom:8px}
        @media print{
          @page{margin:4mm 3mm;size:80mm auto}
          .no-print{display:none}
          body{font-size:16px}
          img{print-color-adjust:exact;-webkit-print-color-adjust:exact}
          *{color:#000!important;background:transparent!important;-webkit-print-color-adjust:exact}
        }
      </style>
    </head><body>
    <div class="wrap">
      <div class="no-print" style="text-align:center;margin-bottom:12px">
        <button onclick="window.print()" style="padding:8px 20px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨️ Chop etish</button>
      </div>
      <div class="header">
        ${logoDataUrl ? `<img class="header-logo" src="${logoDataUrl}" alt="Logo" />` : ''}
        <div class="header-text">
          <div class="logo">BOLAJON KLINIKASI</div>
          <div class="sub">Xizmat ko'rsatish cheki</div>
        </div>
      </div>
      <div class="date">${new Date().toLocaleString('uz-UZ')}</div>
      <table>
        <thead></thead>
        <tbody>
          ${paidRows}
          <tr class="total-row">
            <td colspan="2" style="text-align:center;letter-spacing:2px;">✓ TO'LANDI</td>
          </tr>
          ${reminderSection}
        </tbody>
      </table>
      <div class="patient">
        <div class="name">${p.lastName} ${p.firstName} ${p.fatherName}</div>
        <div class="info">${new Date(p.birthDate).getFullYear()}</div>
      </div>
      <div class="qr-section">
        ${qr ? `<img src="${qr}" alt="QR"/>` : '<p>QR yuklanmadi</p>'}
        <div class="qr-label">Bemor kartasini skanerlang</div>
      </div>
    </div>
    </body></html>`);
    win.document.close();
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

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'info', label: pt.tabs?.general ?? 'Umumiy', icon: <User className="w-4 h-4" /> },
    { key: 'services', label: pt.tabs?.services ?? 'Xizmatlar', icon: <CreditCard className="w-4 h-4" />, count: assignedServices.length },
    { key: 'records', label: pt.tabs?.records ?? 'Tashxislar', icon: <Stethoscope className="w-4 h-4" />, count: medicalRecords.length },
    { key: 'nurse', label: pt.tabs?.nurse ?? 'Hamshira', icon: <ClipboardList className="w-4 h-4" />, count: nurseNotes.length },
    { key: 'lab', label: pt.tabs?.lab ?? 'Laboratoriya', icon: <FlaskConical className="w-4 h-4" />, count: labTests.length },
  ];

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
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            <InfoRow icon={<User className="w-4 h-4 text-slate-400" />} label={pt.fields?.fullName ?? "To'liq ismi"}
              value={`${patient.lastName} ${patient.firstName} ${patient.fatherName}`} />
            <InfoRow icon={<Calendar className="w-4 h-4 text-slate-400" />} label={pt.fields?.birthYear ?? "Tug'ilgan yil"}
              value={`${new Date(patient.birthDate).getFullYear()} (${calcAge(patient.birthDate)} ${pt.fields?.age ?? 'yosh'})`} />
            <InfoRow icon={<Phone className="w-4 h-4 text-slate-400" />} label={pt.fields?.phone ?? 'Telefon'} value={patient.phone} />
            {patient.jshshir && <InfoRow icon={<Hash className="w-4 h-4 text-slate-400" />} label="JSHSHIR" value={patient.jshshir} />}
            {patient.district && <InfoRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label={pt.fields?.district ?? 'Tuman'} value={patient.district} />}
            {patient.houseNumber && <InfoRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Uy raqami" value={patient.houseNumber} />}
            {patient.telegramChatId && <InfoRow icon={<MessageCircle className="w-4 h-4 text-slate-400" />} label="Telegram" value={patient.telegramChatId} />}
          </div>

          {patient.allergies && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                <AlertTriangle className="w-4 h-4" /> Allergiyalar
              </div>
              <p className="text-sm text-red-800">{patient.allergies}</p>
            </div>
          )}

          {patient.medicalHistory && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-700 font-medium mb-2">
                <FileText className="w-4 h-4 text-slate-400" /> Tibbiy tarix
              </div>
              <p className="text-sm text-slate-600">{patient.medicalHistory}</p>
            </div>
          )}

          {/* Admissions summary */}
          {admissions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-700 font-medium mb-3">
                <BedDouble className="w-4 h-4 text-slate-400" /> Yotqizishlar tarixi
              </div>
              <div className="space-y-2">
                {admissions.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">
                      {a.admissionType === 'AMBULATORY' ? 'Ambulator' : 'Statsionar'} —{' '}
                      {a.bed.room.floor}-qavat, {a.bed.room.roomNumber}-xona, {a.bed.bedNumber}-karavot
                    </span>
                    <span className="text-slate-500 text-xs">
                      {fmtDate(a.admissionDate)} {a.dischargeDate ? `→ ${fmtDate(a.dischargeDate)}` : '(faol)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -- FAOLIYAT TARIXI (TIMELINE) -- */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-700 font-medium mb-4">
              <Activity className="w-4 h-4 text-slate-400" /> Faoliyat tarixi
            </div>
            {timelineLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Hali hech qanday faoliyat yo&apos;q</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-100" />
                <div className="space-y-3">
                  {timeline.map(ev => {
                    const dotColors: Record<string, string> = {
                      blue: 'bg-blue-500', slate: 'bg-slate-400', yellow: 'bg-yellow-500',
                      green: 'bg-green-500', indigo: 'bg-indigo-500', purple: 'bg-purple-500',
                      teal: 'bg-teal-500', pink: 'bg-pink-500', orange: 'bg-orange-500',
                      cyan: 'bg-cyan-500',
                    };
                    const dot = dotColors[ev.color] ?? 'bg-slate-400';
                    const d = new Date(ev.time);
                    const timeStr = d.toLocaleString('uz-UZ', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    });
                    return (
                      <div key={ev.id} className="flex gap-4 pl-1">
                        <div className="flex-shrink-0 w-6 flex items-start justify-center pt-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white z-10`} />
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800">{ev.title}</span>
                            <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{timeStr}</span>
                          </div>
                          {ev.detail && (
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ev.detail}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -- TAB: XIZMATLAR ------------------------------------------------- */}
      {activeTab === 'services' && (
        <div className="flex gap-4">
        {/* Left: main list */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tayinlangan xizmatlar */}
          <Section
            title="Tayinlangan xizmatlar"
            count={assignedServices.length}
            action={canManageServices ? (
              <button
                type="button"
                onClick={openAssignModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Xizmat tayinlash
              </button>
            ) : undefined}
          >
            {assignedLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>
            ) : assignedServices.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Hali xizmat tayinlanmagan</p>
            ) : (
              <>
                {assignedServices.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {svc.categoryName}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{svc.itemName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${svc.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {svc.isPaid ? 'To\'langan' : 'Kutilmoqda'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {svc.assignedBy?.name} • {fmtDate(svc.assignedAt)}
                        {svc.paidAt && ` • To'langan: ${fmtDate(svc.paidAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {canSeePrices ? (
                        <span className="text-sm font-semibold text-slate-800">{fmtMoney(Number(svc.price))}</span>
                      ) : (
                        <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          {svc.isPaid ? "To'langan" : "Kutilmoqda"}
                        </span>
                      )}
                      {svc.isPaid && (
                        <button
                          type="button"
                          onClick={() => printReceipt([svc.id])}
                          className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors"
                          title="Chek chiqarish"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!svc.isPaid && canManageServices && (
                        <button
                          type="button"
                          onClick={() => openPayModal(svc)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          To&apos;lash
                        </button>
                      )}
                      {!svc.isPaid && canManageServices && (
                        <button
                          type="button"
                          onClick={() => deleteAssigned(svc.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {/* Jami */}
                {canSeePrices && assignedServices.some(s => s.isPaid) && (
                  <div className="flex justify-between text-sm font-semibold pt-3 border-t border-slate-200">
                    <span className="text-slate-600">Jami to&apos;langan:</span>
                    <span className="text-green-700">
                      {fmtMoney(assignedServices.filter(s => s.isPaid).reduce((sum, s) => sum + Number(s.price), 0))}
                    </span>
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Navbatlar (Uchrashuvlar) */}
          {appointments.length > 0 && (
            <Section title="Navbatlar" count={appointments.length}>
              {appointments.map(a => (
                <div key={a.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {APPT_TYPE_LABELS[a.type] ?? a.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APPT_STATUS_COLORS[a.status] ?? ''}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {a.doctor?.name} • {fmt(a.dateTime)}
                    </p>
                    {a.notes && <p className="text-xs text-slate-400 mt-0.5">{a.notes}</p>}
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>{/* end left */}

        {/* -- Right panel: To'lov tayyorlash (faqat ADMIN/RECEPTIONIST) -- */}
        {canSeePrices && (
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          {/* Chek chiqarish */}
          <button
            type="button"
            onClick={() => printReceipt()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-900 transition-colors w-full"
          >
            <Printer className="w-4 h-4" /> Chek chiqarish
          </button>

          {/* Unpaid services to select */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-800">To&apos;lov tayyorlash</span>
              {assignedServices.some(s => !s.isPaid) && (
                <button type="button" onClick={selectAllUnpaid} className="text-xs text-amber-600 hover:text-amber-800 underline">
                  Barchasini
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {assignedServices.filter(s => !s.isPaid).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Barcha xizmatlar to&apos;langan</p>
              ) : (
                assignedServices.filter(s => !s.isPaid).map(svc => (
                  <label key={svc.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedForPay.has(svc.id)}
                      onChange={() => toggleSelectForPay(svc.id)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{svc.itemName}</p>
                      <p className="text-xs text-slate-400">{svc.categoryName}</p>
                      <p className="text-xs font-semibold text-blue-700 mt-0.5">{fmtMoney(Number(svc.price))}</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Medicines from nurse notes */}
            {profile && profile.nurseNotes?.some(n => Array.isArray(n.medicines) && (n.medicines as unknown[]).length > 0) && (
              <>
                <div className="px-4 py-2 bg-purple-50 border-t border-purple-100">
                  <span className="text-xs font-semibold text-purple-700">💊 Dorilar (eslatma)</span>
                </div>
                {profile.nurseNotes.map(n =>
                  Array.isArray(n.medicines) && (n.medicines as unknown[]).length > 0
                    ? (n.medicines as { name: string; quantity: number; unit: string }[]).map((m, i) => (
                        <div key={`${n.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-50">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700">{m.name}</p>
                            <p className="text-xs text-slate-400">{m.quantity} {m.unit} · {fmtDate(n.createdAt)}</p>
                          </div>
                        </div>
                      ))
                    : null
                )}
              </>
            )}
          </div>

          {/* Bulk pay button */}
          {selectedForPay.size > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkPayModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors w-full"
            >
              <Check className="w-4 h-4" />
              {selectedForPay.size} ta — {fmtMoney(
                assignedServices.filter(s => selectedForPay.has(s.id)).reduce((sum, s) => sum + Number(s.price), 0)
              )} to&apos;lash
            </button>
          )}
        </div>
        )}
      </div>
      )}

      {/* -- PAY MODAL ----------------------------------------------------- */}
      {showPayModal && payModalService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">To&apos;lov qilish</h3>
              <button type="button" onClick={() => setShowPayModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm">
              <p className="text-slate-500 text-xs mb-1">{payModalService.categoryName}</p>
              <p className="font-medium text-slate-800">{payModalService.itemName}</p>
              <p className="text-blue-700 font-bold mt-1">{fmtMoney(Number(payModalService.price))}</p>
            </div>
            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">To&apos;lov usuli</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'CASH', label: 'Naqd pul' },
                  { val: 'CARD', label: 'Karta' },
                  { val: 'CLICK', label: 'Click' },
                  { val: 'PAYME', label: 'Payme' },
                  { val: 'BANK_TRANSFER', label: "Bank o'tkazma" },
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setPayMethod(opt.val)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      payMethod === opt.val
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={confirmPay}
                disabled={!!payingId}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
              >
                {payingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                To&apos;lash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- BULK PAY MODAL ------------------------------------------------ */}
      {showBulkPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">To&apos;lov qilish ({selectedForPay.size} ta)</h3>
              <button type="button" onClick={() => setShowBulkPayModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="mb-4 max-h-40 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl">
              {assignedServices.filter(s => selectedForPay.has(s.id)).map(svc => (
                <div key={svc.id} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-slate-700 truncate">{svc.itemName}</span>
                  <span className="font-semibold text-blue-700 ml-2 flex-shrink-0">{fmtMoney(Number(svc.price))}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 text-sm font-bold bg-blue-50">
                <span>Jami</span>
                <span className="text-blue-700">{fmtMoney(assignedServices.filter(s => selectedForPay.has(s.id)).reduce((sum, s) => sum + Number(s.price), 0))}</span>
              </div>
            </div>
            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">To&apos;lov usuli</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'CASH', label: 'Naqd pul' },
                  { val: 'CARD', label: 'Karta' },
                  { val: 'CLICK', label: 'Click' },
                  { val: 'PAYME', label: 'Payme' },
                  { val: 'BANK_TRANSFER', label: "Bank o'tkazma" },
                ].map(opt => (
                  <button key={opt.val} type="button" onClick={() => setBulkPayMethod(opt.val)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      bulkPayMethod === opt.val ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowBulkPayModal(false)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
                Bekor
              </button>
              <button type="button" onClick={bulkPay} disabled={bulkPaying}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50">
                {bulkPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                To&apos;lash
              </button>
            </div>
          </div>
        </div>
        )}

      {/* -- ASSIGN SERVICE MODAL ------------------------------------------- */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Xizmat tayinlash</h3>
              <button type="button" onClick={() => { setShowAssignModal(false); setAssignCatId(''); setAssignItemId(''); setAssignDoctorId(''); setAssignIsUrgent(false); setAmbRoomId(''); setAmbBedId(''); setAmbBeds([]); }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Category */}
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Bo&apos;lim</label>
              <select
                value={assignCatId}
                onChange={e => { setAssignCatId(e.target.value); setAssignItemId(''); }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">— Bo&apos;lim tanlang —</option>
                {serviceCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Item */}
            {assignCat && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Xizmat turi</label>
                <select
                  value={assignItemId}
                  onChange={e => setAssignItemId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Xizmat tanlang —</option>
                  {visibleItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name} — {fmtMoney(i.price)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Doktor tanlash (faqat doktor kategoriyasi uchun) */}
            {isDoctorCat && assignCat && (
              <div className="mb-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Shifokor <span className="text-red-500">*</span></label>
                <select
                  value={assignDoctorId}
                  onChange={e => setAssignDoctorId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Shifokorni tanlang —</option>
                  {doctorList.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Barcha kategoriyalar uchun xodim tanlash (doktor/ambulator emas) */}
            {!isDoctorCat && !isAmbulatoryCat && assignCat && (
              <div className="mb-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Xodim (ixtiyoriy)</label>
                <select
                  value={assignStaffId}
                  onChange={e => setAssignStaffId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Xodimni tanlang —</option>
                  {allStaffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Shoshilinch checkbox */}
            {isDoctorCat && assignDoctorId && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignIsUrgent}
                  onChange={e => setAssignIsUrgent(e.target.checked)}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-sm text-red-600 font-medium">⚠ Shoshilinch bemor</span>
              </label>
            )}

            {/* Ambulator xona tanlash */}
            {isAmbulatoryCat && assignCat && (
              <>
                <div className="mb-3">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                    Xona (3-qavat ambulator) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={ambRoomId}
                    onChange={e => { setAmbRoomId(e.target.value); setAmbBedId(''); }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">— Xona tanlang —</option>
                    {ambRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.floor}-qavat, {r.roomNumber}-xona
                      </option>
                    ))}
                  </select>
                </div>
                {ambRoomId && (
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                      Bo&apos;sh to&apos;shak <span className="text-red-500">*</span>
                    </label>
                    {ambBedsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400 px-3 py-2 border border-slate-200 rounded-xl">
                        <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
                      </div>
                    ) : ambBeds.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400 border border-slate-200 rounded-xl">
                        Bu xonada bo&apos;sh to&apos;shak yo&apos;q
                      </div>
                    ) : (
                      <select
                        value={ambBedId}
                        onChange={e => setAmbBedId(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">— To&apos;shak tanlang —</option>
                        {ambBeds.map(b => (
                          <option key={b.id} value={b.id}>
                            To&apos;shak {b.bedNumber}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </>
            )}

            {assignItem && (
              <div className={`mb-4 px-4 py-3 rounded-xl flex justify-between text-sm ${assignIsUrgent ? 'bg-red-50' : 'bg-blue-50'}`}>
                <span className="text-slate-700">{assignItem.name}</span>
                <span className={`font-bold ${assignIsUrgent ? 'text-red-700' : 'text-blue-700'}`}>{fmtMoney(assignItem.price)}</span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowAssignModal(false); setAssignCatId(''); setAssignItemId(''); setAssignDoctorId(''); setAssignIsUrgent(false); setAmbRoomId(''); setAmbBedId(''); setAmbBeds([]); }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Bekor
              </button>
              <button
                type="button"
                onClick={saveAssign}
                disabled={!assignItem || assignSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {assignSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Tayinlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- TAB: TASHXISLAR ------------------------------------------------ */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {isDoctor && (
            <div className="flex justify-end">
              <button onClick={() => setShowRecordModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">
                <Plus className="w-4 h-4" /> Tashxis qo&apos;shish
              </button>
            </div>
          )}
          {medicalRecords.length === 0 ? <Empty text="Tashxis mavjud emas" /> : medicalRecords.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-sm font-semibold text-slate-800">{r.doctor?.name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {r.doctor?.specialization?.name ?? r.doctor?.role}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{fmt(r.createdAt)}</span>
              </div>
              <div className="p-4 space-y-3">
                {r.diagnosis && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Tashxis</div>
                    <p className="text-sm text-slate-800">{r.diagnosis}</p>
                  </div>
                )}
                {r.treatment && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Davolash</div>
                    <p className="text-sm text-slate-700">{r.treatment}</p>
                  </div>
                )}
                {r.notes && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Izoh</div>
                    <p className="text-sm text-slate-600">{r.notes}</p>
                  </div>
                )}
                {r.prescriptions.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                      Retsept ({r.prescriptions.length} ta dori)
                    </div>
                    <div className="space-y-2">
                      {r.prescriptions.map(rx => (
                        <div key={rx.id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm font-medium text-blue-900">{rx.medicineName}</span>
                            <span className="text-xs text-blue-700 ml-2">{rx.dosage} • {rx.duration}</span>
                            {rx.instructions && <p className="text-xs text-blue-600 mt-0.5">{rx.instructions}</p>}
                          </div>
                          <button onClick={() => printPrescription(rx)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md" title="Chop etish">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- TAB: HAMSHIRA QAYDLARI ------------------------------------------ */}
      {activeTab === 'nurse' && (
        <div className="space-y-4">
          {isNurse && (
            <div className="flex items-center justify-between">
              {urlNoteType === 'AMBULATORY' && (
                <span className="text-xs font-medium bg-teal-100 text-teal-800 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
                  Ambulator bo&apos;limdan kirildi
                </span>
              )}
              <button
                onClick={() => {
                  setNurseForm(f => ({ ...f, noteType: urlNoteType }));
                  setShowNurseModal(true);
                }}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg">
                <Plus className="w-4 h-4" /> Qayd qo&apos;shish
              </button>
            </div>
          )}

          {nurseNotes.length === 0 ? <Empty text="Hamshira qaydlari yo'q" /> : nurseNotes.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{n.procedure}</span>
                  {n.noteType === 'AMBULATORY' && (
                    <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Ambulator</span>
                  )}
                  {n.admission && (
                    <span className="text-xs text-slate-500">
                      ({n.admission.bed.room.floor}-qavat, {n.admission.bed.room.roomNumber}-xona)
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{fmt(n.createdAt)}</span>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Hamshira: <span className="font-medium">{n.nurse?.name}</span>
              </p>
              {n.notes && <p className="text-sm text-slate-700 mb-2">{n.notes}</p>}
              {n.medicines && n.medicines.length > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Ishlatilgan dorilar</div>
                  <div className="flex flex-wrap gap-2">
                    {n.medicines.map((m, i) => (
                      <span key={i} className="bg-orange-50 text-orange-800 text-xs px-2 py-1 rounded-md">
                        {m.name} — {m.quantity} {m.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* -- TAB: LABORATORIYA ----------------------------------------------- */}
      {activeTab === 'lab' && (
        <div className="space-y-4">
          {canOrderLabTest && (
            <div className="flex justify-end">
              <button
                onClick={openPatientLabOrderModal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Tahlil buyurtma
              </button>
            </div>
          )}
          {labTests.length === 0 ? <Empty text="Laboratoriya tahlillari yo'q" /> : labTests.map(lt => (
            <div key={lt.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{lt.testType?.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LAB_STATUS_COLORS[lt.status] ?? ''}`}>
                    {lt.status === 'PENDING' ? 'Kutilmoqda'
                      : lt.status === 'IN_PROGRESS' ? 'Jarayonda'
                      : lt.status === 'COMPLETED' ? 'Tayyor'
                      : 'Bekor qilindi'}
                  </span>
                  {lt.payment && lt.payment.status !== 'PAID' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                      To&apos;lovini kutyapti
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {lt.status === 'COMPLETED' && (
                    lt.payment && lt.payment.status !== 'PAID' ? (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-600 rounded-md font-medium">
                        <Printer className="w-3 h-3" />
                        To&apos;lov qilinmagan
                      </span>
                    ) : (
                      <button
                        onClick={() => router.push(`/lab/print?patientId=${patientId}&testIds=${lt.id}`)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors font-medium"
                      >
                        <Printer className="w-3 h-3" />
                        Chop
                      </button>
                    )
                  )}
                  <span className="text-xs text-slate-400">{fmt(lt.createdAt)}</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between text-xs text-slate-500 mb-3">
                  <span>Laborant: {lt.labTech?.name}</span>
                  {lt.testType.normalRange && <span>Norma: {lt.testType.normalRange} {lt.testType.unit ?? ''}</span>}
                  {lt.completedAt && <span>Tugallandi: {fmt(lt.completedAt)}</span>}
                </div>

                {lt.notes && (() => {
                  try {
                    const hist = JSON.parse(lt.notes!) as { date: string; from: string | null; to: string; by: string }[];
                    if (Array.isArray(hist) && hist.length > 0) return (
                      <div className="bg-amber-50 rounded-lg px-3 py-2 mb-2">
                        <div className="text-xs font-semibold text-amber-700 uppercase mb-1">O&apos;zgarishlar tarixi</div>
                        {hist.map((h, i) => (
                          <div key={i} className="text-xs text-amber-800">
                            {new Date(h.date).toLocaleString('uz-UZ')} — {h.by}:{' '}
                            {h.from != null ? `${h.from} → ${h.to}` : h.to}
                          </div>
                        ))}
                      </div>
                    );
                  } catch { /* ignore */ }
                  return (
                    <div className="text-sm text-slate-700 mb-2">
                      <span className="font-medium text-slate-500 text-xs uppercase">Izoh: </span>
                      {lt.notes}
                    </div>
                  );
                })()}

                {lt.status === 'COMPLETED' && lt.results && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-green-700 uppercase mb-2">Natija</div>
                    <div className="space-y-1">
                      {Object.entries(lt.results).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm">
                          <span className="text-slate-600">{k}</span>
                          <span className="font-medium text-slate-800">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lt.status === 'PENDING' && (
                  <div className="bg-yellow-50 rounded-lg px-3 py-2 text-sm text-yellow-800">
                    Natija hali kiritilmagan — laboratoriya jarayonida
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Lab Order Modal ------------------------------------------------- */}
      {showPatientLabOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">{patientLabOrderDone ? 'Buyurtma saqlandi' : 'Tahlil buyurtma'}</h2>
              <button onClick={() => { setShowPatientLabOrderModal(false); if (patientLabOrderDone) window.location.reload(); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {patientLabOrderDone ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
                  <p className="text-sm text-slate-500 mb-4">Quyidagi tahlillar tayinlangan xizmatlarga qo&apos;shildi. Qabulxona to&apos;lovni qabul qilgach laboratoriyaga yuboriladi.</p>
                  {patientLabSelectedIds.map(id => {
                    const tt = patientLabAllTypes.find(x => x.id === id);
                    if (!tt) return null;
                    return (
                      <div key={id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-sm text-slate-800">{tt.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-500">{Number(tt.price).toLocaleString()} so&apos;m</span>
                          <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">To&apos;lanmagan</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                  <button type="button" onClick={() => { setShowPatientLabOrderModal(false); window.location.reload(); }} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Yopish</button>
                </div>
              </div>
            ) : (
            <form onSubmit={handlePatientLabOrderSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0 bg-blue-50">
                <p className="text-sm font-medium text-slate-700">
                  Bemor: <span className="font-bold text-slate-900">{patient?.lastName} {patient?.firstName} {patient?.fatherName}</span>
                </p>
              </div>
              {patientLabOrderError && (
                <div className="px-6 pt-3 flex-shrink-0">
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {patientLabOrderError}
                  </div>
                </div>
              )}
              <div className="overflow-y-auto flex-1 px-6 py-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Tahlil turini tanlang <span className="text-red-500">*</span>
                  {patientLabSelectedIds.length > 0 && (
                    <span className="ml-2 normal-case font-normal text-blue-600">({patientLabSelectedIds.length} ta tanlandi)</span>
                  )}
                </div>
                {patientLabAllTypes.length === 0 ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                ) : (() => {
                  const groups: Record<string, LabOrderType[]> = {};
                  for (const tt of patientLabAllTypes) {
                    const cat = tt.category ?? 'Boshqalar';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(tt);
                  }
                  return Object.entries(groups).map(([cat, items]) => {
                    const isOpen = patientLabOpenGroups.has(cat);
                    const groupSelected = items.filter(it => patientLabSelectedIds.includes(it.id));
                    return (
                      <div key={cat} className="mb-2 border border-slate-200 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => setPatientLabOpenGroups(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">{cat}</span>
                            {groupSelected.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{groupSelected.length} ta</span>}
                          </div>
                          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {isOpen && (
                          <div className="divide-y divide-slate-50">
                            {items.map(tt => {
                              const checked = patientLabSelectedIds.includes(tt.id);
                              return (
                                <label key={tt.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${checked ? 'bg-blue-50/50' : ''}`}>
                                  <input type="checkbox" checked={checked} onChange={() => setPatientLabSelectedIds(prev => prev.includes(tt.id) ? prev.filter(x => x !== tt.id) : [...prev, tt.id])} className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                                  <span className="flex-1 text-sm text-slate-800">{tt.name}</span>
                                  <span className="text-sm text-slate-500 font-medium">{tt.price.toLocaleString()} so&apos;m</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                {patientLabSelectedIds.length > 0 && (() => {
                  const groups: Record<string, { name: string; total: number }> = {};
                  for (const id of patientLabSelectedIds) {
                    const tt = patientLabAllTypes.find(x => x.id === id);
                    if (!tt) continue;
                    const cat = tt.category ?? 'Boshqalar';
                    if (!groups[cat]) groups[cat] = { name: cat, total: 0 };
                    groups[cat].total += Number(tt.price);
                  }
                  const grandTotal = Object.values(groups).reduce((s, g) => s + g.total, 0);
                  const groupEntries = Object.values(groups);
                  return (
                    <div className="mb-4 bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                      {groupEntries.map(g => (
                        <div key={g.name} className="flex justify-between text-sm text-slate-600">
                          <span>{g.name}</span>
                          <span className="font-medium">{g.total.toLocaleString()} so&apos;m</span>
                        </div>
                      ))}
                      {groupEntries.length > 1 && (
                        <div className="flex justify-between text-sm font-bold text-slate-800 pt-1.5 border-t border-slate-200">
                          <span>Jami</span>
                          <span>{grandTotal.toLocaleString()} so&apos;m</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setShowPatientLabOrderModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">Bekor</button>
                  <button type="submit" disabled={patientLabOrderSaving || patientLabSelectedIds.length === 0} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                    {patientLabOrderSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Buyurtma berish ({patientLabSelectedIds.length})
                  </button>
                </div>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

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
            <button onClick={printQr} disabled={!qrDataUrl}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Printer className="w-4 h-4" /> Chop etish
            </button>
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
        <Modal title="Tashxis qo'shish" onClose={() => setShowRecordModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tashxis</label>
              <textarea rows={2} value={recordForm.diagnosis} placeholder="Tashxis..."
                onChange={e => setRecordForm(f => ({ ...f, diagnosis: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Davolash</label>
              <textarea rows={2} value={recordForm.treatment} placeholder="Davolash rejasi..."
                onChange={e => setRecordForm(f => ({ ...f, treatment: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Izoh</label>
              <textarea rows={2} value={recordForm.notes} placeholder="Qo'shimcha izoh..."
                onChange={e => setRecordForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
            </div>
          </div>
          {/* Dori yozish */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Retsept — Dorilar</span>
              <button
                type="button"
                onClick={() => setRecordForm(f => ({
                  ...f,
                  prescriptions: [...f.prescriptions, { medicineName: '', dosage: '', duration: '', instructions: '' }]
                }))}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-3.5 h-3.5" /> Dori qo&apos;shish
              </button>
            </div>
            {recordForm.prescriptions.map((rx, idx) => (
              <div key={idx} className="mb-3 p-3 border border-slate-200 rounded-lg space-y-2 bg-blue-50/40">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Dori nomi *"
                    value={rx.medicineName}
                    onChange={e => setRecordForm(f => ({
                      ...f,
                      prescriptions: f.prescriptions.map((r, i) => i === idx ? { ...r, medicineName: e.target.value } : r)
                    }))}
                    className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setRecordForm(f => ({ ...f, prescriptions: f.prescriptions.filter((_, i) => i !== idx) }))}
                    className="text-red-400 hover:text-red-600 px-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Dozasi * (masalan: 1 x 3)"
                    value={rx.dosage}
                    onChange={e => setRecordForm(f => ({
                      ...f,
                      prescriptions: f.prescriptions.map((r, i) => i === idx ? { ...r, dosage: e.target.value } : r)
                    }))}
                    className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <input
                    type="text"
                    placeholder="Muddat * (masalan: 5 kun)"
                    value={rx.duration}
                    onChange={e => setRecordForm(f => ({
                      ...f,
                      prescriptions: f.prescriptions.map((r, i) => i === idx ? { ...r, duration: e.target.value } : r)
                    }))}
                    className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Ko'rsatma (ixtiyoriy)"
                  value={rx.instructions}
                  onChange={e => setRecordForm(f => ({
                    ...f,
                    prescriptions: f.prescriptions.map((r, i) => i === idx ? { ...r, instructions: e.target.value } : r)
                  }))}
                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowRecordModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm">
              Bekor qilish
            </button>
            <button onClick={saveRecord} disabled={savingRecord || (!recordForm.diagnosis.trim() && !recordForm.treatment.trim() && !recordForm.notes.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-60">
              {savingRecord && <Loader2 className="w-4 h-4 animate-spin" />}
              Saqlash
            </button>
          </div>
        </Modal>
      )}

      {/* -- Nurse Note Modal ------------------------------------------------ */}
      {showNurseModal && (
        <Modal title={nurseForm.noteType === 'AMBULATORY' ? "Ambulator qayd qo'shish" : "Hamshira qaydini qo'shish"} onClose={() => setShowNurseModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Muolaja nomi *</label>
              <input type="text" value={nurseForm.procedure} placeholder="Ukol, infuziya, bog'lam..."
                onChange={e => setNurseForm(f => ({ ...f, procedure: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Izoh</label>
              <textarea value={nurseForm.notes} rows={3}
                onChange={e => setNurseForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Muolaja haqida qo'shimcha ma'lumot..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowNurseModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm">
              {t.common.cancel}
            </button>
            <button onClick={saveNurseNote} disabled={savingNote || !nurseForm.procedure.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm disabled:opacity-60">
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Saqlash
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// --- UI helpers ---------------------------------------------------------------

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon}
      <span className="text-sm text-slate-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}

function Section({ title, count, children, action }: { title: string; count: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <span className="text-xs text-slate-500">{count} ta</span>
        </div>
        {action}
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function printPrescription(rx: { medicineName: string; dosage: string; duration: string; instructions?: string; createdAt: string }) {
  const html = `<html><head><meta charset="utf-8"/><title>Retsept</title>
    <style>body{font-family:sans-serif;padding:24px}h2{margin-bottom:16px}p{margin:8px 0}</style>
    </head><body>
    <h2>Retsept</h2>
    <p><strong>Dori:</strong> ${rx.medicineName}</p>
    <p><strong>Dozasi:</strong> ${rx.dosage}</p>
    <p><strong>Muddati:</strong> ${rx.duration}</p>
    ${rx.instructions ? `<p><strong>Ko'rsatma:</strong> ${rx.instructions}</p>` : ''}
    <p style="margin-top:24px;color:#888;font-size:12px">Sana: ${new Date(rx.createdAt).toLocaleDateString('uz-UZ')}</p>
    </body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;height:400px;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 2000);
}

function printPrescriptions(
  patient: { firstName: string; lastName: string; fatherName: string; birthDate: string },
  rxList: { medicineName: string; dosage: string; duration: string; instructions: string }[]
) {
  const today = new Date().toLocaleDateString('uz-UZ');
  const patientName = `${patient.lastName} ${patient.firstName} ${patient.fatherName}`;
  const age = new Date().getFullYear() - new Date(patient.birthDate).getFullYear();

  const rows = rxList.map((rx, i) => `
    <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed #000;">
      <b>${i + 1}. ${rx.medicineName}</b><br/>
      Dozasi: ${rx.dosage}<br/>
      Muddat: ${rx.duration}<br/>
      ${rx.instructions ? `Ko'rsatma: ${rx.instructions}<br/>` : ''}
    </div>
  `).join('');

  const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <style>
      * { color: #000 !important; background: transparent !important; }
      body { font-family: 'Courier New', monospace; font-size: 12px; padding: 8px; margin: 0; width: 72mm; }
      h2 { font-size: 14px; text-align: center; margin: 0 0 8px; }
      .center { text-align: center; }
      .line { border-top: 1px dashed #000; margin: 6px 0; }
      @media print { body { width: 72mm; } }
    </style>
  </head><body>
    <h2>BOLAJON KLINIKASI</h2>
    <div class="center" style="font-size:11px;">RETSEPT</div>
    <div class="line"></div>
    <div>Bemor: <b>${patientName}</b></div>
    <div>Yosh: ${age}</div>
    <div>Sana: ${today}</div>
    <div class="line"></div>
    ${rows}
    <div class="line"></div>
    <div class="center" style="font-size:10px;">Shifokor imzosi: ___________</div>
  </body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:400px;height:600px;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 2000);
  }, 300);
}
