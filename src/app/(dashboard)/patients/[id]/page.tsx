'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { floorLabel } from '@/lib/utils';
import { printQr, printReceipt } from './_lib/print-templates';
import { Modal } from './_components/ui';
import { InfoTab } from './_components/InfoTab';
import { ServicesTab } from './_components/ServicesTab';
import { RecordsTab } from './_components/RecordsTab';
import { NurseTab } from './_components/NurseTab';
import { LabTab } from './_components/LabTab';
import { MedicalRecordModal } from './_components/modals/MedicalRecordModal';
import { NurseNoteModal } from './_components/modals/NurseNoteModal';
import { LabOrderModal } from './_components/modals/LabOrderModal';
import {
  ArrowLeft, Pencil, Trash2, Check, X, Loader2, AlertCircle,
  User, Phone, MapPin,
  Hash, Plus, Printer,
  Stethoscope, CreditCard, FlaskConical, BedDouble, ClipboardList, QrCode,
  Activity,
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

interface InpatientTask {
  id: string; title: string; description?: string | null; status: string;
  deadline: string; createdAt: string; startedAt?: string | null; completedAt?: string | null;
  assigner: { id: string; name: string; role: string };
  assignee: { id: string; name: string; role: string };
}

interface DoctorNote {
  id: string; diagnosis?: string | null; treatment?: string | null; notes?: string | null;
  createdAt: string;
  doctor: { id: string; name: string; role: string; specialization?: { name: string } | null };
  prescriptions: { id: string; medicineName: string; dosage: string; duration: string; instructions?: string | null }[];
}

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

  // Statsionar tab state
  const [inpatientTasks, setInpatientTasks] = useState<InpatientTask[]>([]);
  const [inpatientNotes, setInpatientNotes] = useState<DoctorNote[]>([]);
  const [inpatientLoading, setInpatientLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigneeId: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState({ diagnosis: '', treatment: '', notes: '' });
  const [savingInpatientNote, setSavingInpatientNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [nurseList, setNurseList] = useState<{ id: string; name: string; role: string }[]>([]);
  const [currentDays, setCurrentDays] = useState(0);
  const [currentAmount, setCurrentAmount] = useState(0);

  // Vitals
  interface Vital {
    id: string; temperature?: number | null; bloodPressureSystolic?: number | null;
    bloodPressureDiastolic?: number | null; pulse?: number | null;
    oxygenSaturation?: number | null; weight?: number | null; notes?: string | null;
    createdAt: string; recordedBy?: { name: string; role: string } | null;
  }
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    temperature: '', bloodPressureSystolic: '', bloodPressureDiastolic: '',
    pulse: '', oxygenSaturation: '', weight: '', notes: '',
  });
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsError, setVitalsError] = useState<string | null>(null);

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

  // Statsionar tab — data fetch
  const activeAdmission = profile?.admissions.find(a => !a.dischargeDate) ?? null;

  const fetchInpatientData = useCallback(async () => {
    if (!activeAdmission) return;
    setInpatientLoading(true);
    try {
      const [tasksRes, notesRes, vitalsRes] = await Promise.all([
        fetch(`/api/admissions/${activeAdmission.id}/tasks`),
        fetch(`/api/admissions/${activeAdmission.id}/doctor-notes`),
        fetch(`/api/admissions/${activeAdmission.id}/vitals`),
      ]);
      if (tasksRes.ok) setInpatientTasks(await tasksRes.json());
      if (notesRes.ok) setInpatientNotes(await notesRes.json());
      if (vitalsRes.ok) setVitals(await vitalsRes.json());
    } finally { setInpatientLoading(false); }
  }, [activeAdmission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'inpatient') fetchInpatientData();
  }, [activeTab, fetchInpatientData]);

  // Live cost calculation for active admission
  useEffect(() => {
    if (!activeAdmission || activeAdmission.dischargeDate) return;
    const calc = () => {
      const now = new Date();
      const admDate = new Date(activeAdmission.admissionDate);
      const hours = (now.getTime() - admDate.getTime()) / (1000 * 60 * 60);
      const days = hours <= 12 ? 0 : Math.ceil(hours / 24);
      setCurrentDays(days);
      setCurrentAmount(days * Number(activeAdmission.dailyRate));
    };
    calc();
    const timer = setInterval(calc, 60000);
    return () => clearInterval(timer);
  }, [activeAdmission?.id, activeAdmission?.admissionDate, activeAdmission?.dailyRate, activeAdmission?.dischargeDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load nurses when task modal opens
  useEffect(() => {
    if (!showTaskModal || nurseList.length > 0) return;
    fetch('/api/staff?role=NURSE,HEAD_NURSE')
      .then(r => r.json())
      .then(d => setNurseList((d.data ?? d).filter((u: { isActive: boolean }) => u.isActive)))
      .catch(() => null);
  }, [showTaskModal, nurseList.length]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdmission) return;
    setSavingTask(true); setTaskError(null);
    try {
      const res = await fetch(`/api/admissions/${activeAdmission.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Xatolik'); }
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', assigneeId: '' });
      await fetchInpatientData();
    } catch (err) { setTaskError(err instanceof Error ? err.message : 'Xatolik'); }
    finally { setSavingTask(false); }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      await fetchInpatientData();
    } catch { /* ignore */ }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      await fetchInpatientData();
    } catch { /* ignore */ }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdmission) return;
    setSavingInpatientNote(true); setNoteError(null);
    try {
      const res = await fetch(`/api/admissions/${activeAdmission.id}/doctor-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Xatolik'); }
      setShowNoteModal(false);
      setNoteForm({ diagnosis: '', treatment: '', notes: '' });
      await fetchInpatientData();
    } catch (err) { setNoteError(err instanceof Error ? err.message : 'Xatolik'); }
    finally { setSavingInpatientNote(false); }
  };

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdmission) return;
    setSavingVitals(true); setVitalsError(null);
    try {
      const body: Record<string, number | string | undefined> = {};
      if (vitalsForm.temperature) body.temperature = parseFloat(vitalsForm.temperature);
      if (vitalsForm.bloodPressureSystolic) body.bloodPressureSystolic = parseInt(vitalsForm.bloodPressureSystolic);
      if (vitalsForm.bloodPressureDiastolic) body.bloodPressureDiastolic = parseInt(vitalsForm.bloodPressureDiastolic);
      if (vitalsForm.pulse) body.pulse = parseInt(vitalsForm.pulse);
      if (vitalsForm.oxygenSaturation) body.oxygenSaturation = parseFloat(vitalsForm.oxygenSaturation);
      if (vitalsForm.weight) body.weight = parseFloat(vitalsForm.weight);
      if (vitalsForm.notes) body.notes = vitalsForm.notes;
      const res = await fetch(`/api/admissions/${activeAdmission.id}/vitals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Xatolik'); }
      setShowVitalsModal(false);
      setVitalsForm({ temperature: '', bloodPressureSystolic: '', bloodPressureDiastolic: '', pulse: '', oxygenSaturation: '', weight: '', notes: '' });
      await fetchInpatientData();
    } catch (err) { setVitalsError(err instanceof Error ? err.message : 'Xatolik'); }
    finally { setSavingVitals(false); }
  };

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
    // Round-robin: rooms va recommendedBed ni atomik (Promise.all) yuklaymiz —
    // race condition'ning oldini olish uchun setAmbRooms va setRecommendedBed
    // bir vaqtda ketma-ket o'rnatiladi, useEffect qayta-qayta trigger bo'lmaydi.
    Promise.all([
      fetch('/api/rooms?isAmbulatory=true').then(r => r.ok ? r.json() : []),
      fetch('/api/rooms/next-ambulatory-bed').then(r => r.ok ? r.json() : null),
    ])
      .then(([roomsData, rec]: [unknown, { roomId: string | null; bedId: string | null } | null]) => {
        const all = Array.isArray(roomsData)
          ? (roomsData as typeof ambRooms)
          : (((roomsData as { data?: typeof ambRooms } | null)?.data) ?? []);
        // Faqat kamida 1 ta bo'sh to'shagi bor xonalar
        const available = all.filter(r => r.beds.some(b => b.admissions.length === 0));
        setAmbRooms(available);
        const recBed = rec && (rec.roomId || rec.bedId)
          ? { roomId: rec.roomId, bedId: rec.bedId }
          : null;
        setRecommendedBed(recBed);
        // Xona tanlash: tavsiyada bo'lsa va available ichida bo'lsa shu, aks holda available[0]
        const targetRoomId = recBed && recBed.roomId && available.some(r => r.id === recBed.roomId)
          ? recBed.roomId
          : (available[0]?.id ?? '');
        if (targetRoomId) setAmbRoomId(targetRoomId);
      })
      .catch(() => null);
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
  const [ambRooms, setAmbRooms] = useState<{ id: string; roomNumber: string; floor: number; beds: { id: string; admissions: { id: string }[] }[] }[]>([]);
  const [ambRoomId, setAmbRoomId] = useState('');
  const [ambBeds, setAmbBeds] = useState<{ id: string; bedNumber: string; status: string }[]>([]);
  const [ambBedId, setAmbBedId] = useState('');
  const [ambBedsLoading, setAmbBedsLoading] = useState(false);
  // Server tomonidan tavsiya etilgan keyingi bo'sh to'shak (round-robin)
  const [recommendedBed, setRecommendedBed] = useState<{ roomId: string | null; bedId: string | null } | null>(null);

  useEffect(() => {
    if (!isLabCat) return;
    fetch('/api/lab-test-types')
      .then(r => r.json())
      .then(d => setLabTestTypes(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setLabTestTypes([]));
  }, [isLabCat]);

  // Lab order modal trigger (state lives inside LabOrderModal)
  const [showPatientLabOrderModal, setShowPatientLabOrderModal] = useState(false);

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

  // Ambulatory rooms va recommendedBed — atomik tarzda openAssignModal'da yuklanadi
  // (race condition'ning oldini olish uchun useEffect bu yerdan olib tashlandi).

  // Ambulatory beds — xona o'zgarganda server tavsiyasiga asosan to'shak avtomatik tanlanadi
  useEffect(() => {
    if (!ambRoomId) { setAmbBeds([]); setAmbBedId(''); return; }
    setAmbBedsLoading(true);
    fetch(`/api/rooms/${ambRoomId}/beds?status=AVAILABLE`)
      .then(r => r.json())
      .then(d => {
        const beds = Array.isArray(d) ? d : [];
        setAmbBeds(beds);
        if (beds.length === 0) { setAmbBedId(''); return; }
        // Round-robin: agar server tavsiyasi shu xonadagi mavjud to'shakka mos kelsa — uni tanlash
        const recBedId = recommendedBed?.bedId ?? null;
        const recRoomId = recommendedBed?.roomId ?? null;
        const recommendedFits = recBedId !== null
          && recRoomId === ambRoomId
          && beds.some((b: { id: string }) => b.id === recBedId);
        if (recommendedFits && recBedId) setAmbBedId(recBedId);
        else setAmbBedId(beds[0].id);
      })
      .catch(() => { setAmbBeds([]); setAmbBedId(''); })
      .finally(() => setAmbBedsLoading(false));
  }, [ambRoomId, recommendedBed]);

  const visibleItems: ServiceCategoryItem[] = isLabCat ? labTestTypes : (assignCat?.items ?? []);
  const assignItem = visibleItems.find(i => i.id === assignItemId);

  const saveAssign = async () => {
    if (!assignCat || !assignItem) return;
    if (isDoctorCat && !assignDoctorId) { alert('Iltimos, doktor tanlang'); return; }
    const activeAmbAdm = profile?.admissions.find(
      a => a.admissionType === 'AMBULATORY' && ['PENDING', 'ACTIVE'].includes(a.status) && !a.dischargeDate
    );
    if (isAmbulatoryCat && !activeAmbAdm && !ambBedId) { alert("Iltimos, ambulator to'shak tanlang"); return; }
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
      setAssignStaffId(''); setAmbRoomId(''); setAmbBedId(''); setAmbBeds([]); setAmbRooms([]);
      setRecommendedBed(null);
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
          onAssignClick={openAssignModal}
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
              <button type="button" onClick={() => { setShowAssignModal(false); setAssignCatId(''); setAssignItemId(''); setAssignDoctorId(''); setAssignIsUrgent(false); setAmbRoomId(''); setAmbBedId(''); setAmbBeds([]); setAmbRooms([]); setRecommendedBed(null); }}>
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
            {isAmbulatoryCat && assignCat && (() => {
              const activeAmbAdm = profile?.admissions.find(
                a => a.admissionType === 'AMBULATORY' && ['PENDING', 'ACTIVE'].includes(a.status) && !a.dischargeDate
              ) ?? null;
              if (activeAmbAdm) {
                // Bemor allaqachon to'shakda — yangi to'shak tanlash shart emas
                return (
                  <div className="mb-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl text-sm">
                    <div className="font-semibold text-teal-800 mb-0.5">Bemor allaqachon joylashtirilgan</div>
                    <div className="text-teal-700">
                      {floorLabel(activeAmbAdm.bed.room.floor)}, {activeAmbAdm.bed.room.roomNumber}-xona — To&apos;shak №{activeAmbAdm.bed.bedNumber}
                    </div>
                    <div className="text-teal-600 text-xs mt-1">Yangi xizmat shu to&apos;shakga qo&apos;shiladi</div>
                  </div>
                );
              }
              // Yangi joylashtirish — xona/to'shak tanlash
              return (
                <>
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                      Xona (ambulator) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={ambRoomId}
                      onChange={e => { setAmbRoomId(e.target.value); setAmbBedId(''); }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">— Xona tanlang —</option>
                      {ambRooms.map(r => (
                        <option key={r.id} value={r.id}>
                          {floorLabel(r.floor)}, {r.roomNumber}-xona
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
              );
            })()}

            {assignItem && (
              <div className={`mb-4 px-4 py-3 rounded-xl flex justify-between text-sm ${assignIsUrgent ? 'bg-red-50' : 'bg-blue-50'}`}>
                <span className="text-slate-700">{assignItem.name}</span>
                <span className={`font-bold ${assignIsUrgent ? 'text-red-700' : 'text-blue-700'}`}>{fmtMoney(assignItem.price)}</span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowAssignModal(false); setAssignCatId(''); setAssignItemId(''); setAssignDoctorId(''); setAssignIsUrgent(false); setAmbRoomId(''); setAmbBedId(''); setAmbBeds([]); setAmbRooms([]); setRecommendedBed(null); }}
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
        <div className="space-y-6">
          {/* Joriy to'lov kartasi */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Statsionar ma&apos;lumoti</div>
                <div className="text-sm text-slate-700 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-slate-400" />
                  {floorLabel(activeAdmission.bed.room.floor)}, Xona {activeAdmission.bed.room.roomNumber}, Krovat {activeAdmission.bed.bedNumber}
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{activeAdmission.bed.room.type}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Yotgan: {fmt(activeAdmission.admissionDate)}</div>
                {activeAdmission.notes && <div className="text-xs text-slate-500 mt-1">Tashxis: {activeAdmission.notes}</div>}
              </div>
              {canSeePrices && (
                <div className="text-right">
                  <div className="text-xs text-slate-500 mb-0.5">Kunlik narx</div>
                  <div className="text-base font-semibold text-slate-700">{fmtMoney(Number(activeAdmission.dailyRate))}</div>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {currentDays === 0 ? (
                  <span className="text-green-600 font-medium">12 soat to&apos;lmagan — bepul</span>
                ) : (
                  <span>Yig&apos;ilgan: <strong className="text-slate-800">{currentDays} kun</strong></span>
                )}
              </div>
              {canSeePrices && (
                <div className="text-lg font-bold text-blue-700">{currentDays > 0 ? fmtMoney(currentAmount) : 'Bepul'}</div>
              )}
            </div>
          </div>

          {/* Ukol / Muolaja buyurtmalari */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" /> Ukol / Muolaja buyurtmalari
                {inpatientTasks.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{inpatientTasks.length}</span>}
              </h3>
              {isDoctor && (
                <button onClick={() => setShowTaskModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
                  <Plus className="w-3.5 h-3.5" /> Yangi buyurtma
                </button>
              )}
            </div>
            {inpatientLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
            ) : inpatientTasks.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">Buyurtmalar yo&apos;q</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {inpatientTasks.map(task => {
                  const statusColors: Record<string, string> = {
                    PENDING: 'bg-slate-100 text-slate-600',
                    IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
                    COMPLETED: 'bg-green-100 text-green-700',
                  };
                  const statusLabels: Record<string, string> = {
                    PENDING: 'Kutilmoqda', IN_PROGRESS: 'Bajarilmoqda', COMPLETED: 'Bajarildi',
                  };
                  const isMyTask = task.assignee.id === session?.user?.id;
                  return (
                    <div key={task.id} className="px-5 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{task.title}</div>
                        {task.description && <div className="text-xs text-slate-500 mt-0.5">{task.description}</div>}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                          <span>Hamshira: <strong className="text-slate-600">{task.assignee.name}</strong></span>
                          <span>{fmt(task.createdAt)}</span>
                          {task.completedAt && <span className="text-green-600">Bajarildi: {fmt(task.completedAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[task.status] ?? ''}`}>
                          {statusLabels[task.status] ?? task.status}
                        </span>
                        {isMyTask && task.status === 'PENDING' && (
                          <button onClick={() => handleStartTask(task.id)}
                            className="text-xs px-2 py-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-md transition-colors">
                            Boshlash
                          </button>
                        )}
                        {isMyTask && task.status === 'IN_PROGRESS' && (
                          <button onClick={() => handleCompleteTask(task.id)}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors">
                            <Check className="w-3 h-3" /> Bajarildi
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vitals — harorat, bosim, puls */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-500" /> Ko&apos;rsatkichlar (Vitals)
                {vitals.length > 0 && <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{vitals.length}</span>}
              </h3>
              {isNurse && (
                <button onClick={() => setShowVitalsModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors font-medium">
                  <Plus className="w-3.5 h-3.5" /> Kiritish
                </button>
              )}
            </div>
            {vitals.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">Ko&apos;rsatkichlar kiritilmagan</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Sana</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">T°C</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Bosim</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Puls</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">SpO2</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Vazn</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">Kim</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {vitals.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500">{fmt(v.createdAt)}</td>
                        <td className="px-3 py-2">
                          {v.temperature != null ? (
                            <span className={`font-medium ${v.temperature >= 37.5 ? 'text-red-600' : v.temperature < 36 ? 'text-blue-600' : 'text-slate-700'}`}>
                              {v.temperature}°C
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {v.bloodPressureSystolic != null && v.bloodPressureDiastolic != null
                            ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {v.pulse != null ? (
                            <span className={`font-medium ${v.pulse > 100 || v.pulse < 60 ? 'text-orange-600' : 'text-slate-700'}`}>
                              {v.pulse}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {v.oxygenSaturation != null ? (
                            <span className={`font-medium ${v.oxygenSaturation < 95 ? 'text-red-600' : 'text-slate-700'}`}>
                              {v.oxygenSaturation}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{v.weight != null ? `${v.weight} kg` : '—'}</td>
                        <td className="px-3 py-2 text-slate-400">{v.recordedBy?.name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Doktor kunlik ko'rik qaydlari */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-purple-500" /> Doktor kunlik ko&apos;rik qaydlari
                {inpatientNotes.length > 0 && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{inpatientNotes.length}</span>}
              </h3>
              {isDoctor && (
                <button onClick={() => setShowNoteModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium">
                  <Plus className="w-3.5 h-3.5" /> Yangi qayd
                </button>
              )}
            </div>
            {inpatientLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
            ) : inpatientNotes.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">Ko&apos;rik qaydlari yo&apos;q</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {inpatientNotes.map(note => (
                  <div key={note.id} className="px-5 py-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-slate-500">
                        <strong className="text-slate-700">{note.doctor.name}</strong>
                        {note.doctor.specialization && <span className="text-slate-400"> · {note.doctor.specialization.name}</span>}
                      </div>
                      <span className="text-xs text-slate-400">{fmt(note.createdAt)}</span>
                    </div>
                    {note.diagnosis && (
                      <div className="text-sm mb-1"><span className="text-xs font-semibold text-slate-500 uppercase">Tashxis: </span><span className="text-slate-800">{note.diagnosis}</span></div>
                    )}
                    {note.treatment && (
                      <div className="text-sm mb-1"><span className="text-xs font-semibold text-slate-500 uppercase">Muolaja: </span><span className="text-slate-800">{note.treatment}</span></div>
                    )}
                    {note.notes && (
                      <div className="text-sm text-slate-600">{note.notes}</div>
                    )}
                    {note.prescriptions.length > 0 && (
                      <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2">
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Retsept</div>
                        {note.prescriptions.map(p => (
                          <div key={p.id} className="text-xs text-slate-700">
                            {p.medicineName} — {p.dosage}, {p.duration}
                            {p.instructions && <span className="text-slate-400"> ({p.instructions})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -- Task Modal ------------------------------------------------------- */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Yangi muolaja buyurtmasi</h2>
              <button onClick={() => { setShowTaskModal(false); setTaskError(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateTask} className="px-6 py-4 space-y-4">
              {taskError && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{taskError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Muolaja nomi <span className="text-red-500">*</span></label>
                <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} required
                  placeholder="Masalan: Ampisillin 500mg ukoli"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Izoh</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  placeholder="Qo'shimcha ko'rsatmalar..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hamshira <span className="text-red-500">*</span></label>
                <select value={taskForm.assigneeId} onChange={e => setTaskForm(f => ({ ...f, assigneeId: e.target.value }))} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Hamshirani tanlang</option>
                  {nurseList.length === 0 && allStaffList.filter(s => ['NURSE','HEAD_NURSE'].includes(s.role)).map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                  {nurseList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowTaskModal(false); setTaskError(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Bekor</button>
                <button type="submit" disabled={savingTask}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                  {savingTask && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -- Doctor Note Modal ----------------------------------------------- */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Kunlik ko&apos;rik qaydı</h2>
              <button onClick={() => { setShowNoteModal(false); setNoteError(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateNote} className="px-6 py-4 space-y-4">
              {noteError && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{noteError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tashxis</label>
                <input value={noteForm.diagnosis} onChange={e => setNoteForm(f => ({ ...f, diagnosis: e.target.value }))}
                  placeholder="Masalan: O'tkir bronxit"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Muolaja</label>
                <input value={noteForm.treatment} onChange={e => setNoteForm(f => ({ ...f, treatment: e.target.value }))}
                  placeholder="Masalan: Ampisillin 2x1"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Izohlar</label>
                <textarea value={noteForm.notes} onChange={e => setNoteForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  placeholder="Bemorning holati, kuzatuvlar..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowNoteModal(false); setNoteError(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Bekor</button>
                <button type="submit" disabled={savingInpatientNote}
                  className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                  {savingInpatientNote && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -- Vitals Modal ---------------------------------------------------- */}
      {showVitalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Ko&apos;rsatkichlarni kiritish</h2>
              <button onClick={() => { setShowVitalsModal(false); setVitalsError(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveVitals} className="px-6 py-4 space-y-4">
              {vitalsError && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{vitalsError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Harorat (°C)</label>
                  <input type="number" step="0.1" value={vitalsForm.temperature} onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))}
                    placeholder="36.6" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Puls (urish/daqiqa)</label>
                  <input type="number" value={vitalsForm.pulse} onChange={e => setVitalsForm(f => ({ ...f, pulse: e.target.value }))}
                    placeholder="72" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bosim sistolik (mmHg)</label>
                  <input type="number" value={vitalsForm.bloodPressureSystolic} onChange={e => setVitalsForm(f => ({ ...f, bloodPressureSystolic: e.target.value }))}
                    placeholder="120" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bosim diastolik (mmHg)</label>
                  <input type="number" value={vitalsForm.bloodPressureDiastolic} onChange={e => setVitalsForm(f => ({ ...f, bloodPressureDiastolic: e.target.value }))}
                    placeholder="80" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">SpO2 (%)</label>
                  <input type="number" step="0.1" value={vitalsForm.oxygenSaturation} onChange={e => setVitalsForm(f => ({ ...f, oxygenSaturation: e.target.value }))}
                    placeholder="98" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vazn (kg)</label>
                  <input type="number" step="0.1" value={vitalsForm.weight} onChange={e => setVitalsForm(f => ({ ...f, weight: e.target.value }))}
                    placeholder="70" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Izoh</label>
                <textarea value={vitalsForm.notes} onChange={e => setVitalsForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder="Qo'shimcha kuzatuvlar..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowVitalsModal(false); setVitalsError(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Bekor</button>
                <button type="submit" disabled={savingVitals}
                  className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                  {savingVitals && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
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


