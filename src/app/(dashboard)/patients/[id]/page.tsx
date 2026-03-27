'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  User,
  Phone,
  Calendar,
  MapPin,
  FileText,
  AlertTriangle,
  MessageCircle,
  Hash,
  Plus,
  Printer,
  ChevronDown,
  ChevronUp,
  Droplets,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  jshshir: string;
  birthDate: string;
  gender?: string;
  bloodType?: string;
  district: string | null;
  houseNumber: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  telegramChatId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EditForm {
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  jshshir: string;
  birthDate: string;
  district: string;
  houseNumber: string;
  medicalHistory: string;
  allergies: string;
  telegramChatId: string;
}

interface Prescription {
  id: string;
  medicineName: string;
  dosage: string;
  duration: string;
  instructions?: string;
  createdAt: string;
}

interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  createdAt: string;
  doctor: { name: string; role: string };
  prescriptions: Prescription[];
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  category: string;
  status: string;
  createdAt: string;
}

interface DoctorUser {
  id: string;
  name: string;
  role: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function patientToForm(patient: Patient): EditForm {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    fatherName: patient.fatherName,
    phone: patient.phone,
    jshshir: patient.jshshir,
    birthDate: patient.birthDate.slice(0, 10),
    district: patient.district ?? '',
    houseNumber: patient.houseNumber ?? '',
    medicalHistory: patient.medicalHistory ?? '',
    allergies: patient.allergies ?? '',
    telegramChatId: patient.telegramChatId ?? '',
  };
}

function formatCurrency(amount: number, unit: string): string {
  return `${amount.toLocaleString('uz-UZ')} ${unit}`;
}

function handlePrint(prescription: Prescription, t: ReturnType<typeof useLanguage>['t']) {
  const printContent = `
    <html>
    <head><meta charset="utf-8"/><title>${t.medicalRecords.prescription}</title>
    <style>body{font-family:sans-serif;padding:24px}h2{margin-bottom:16px}p{margin:8px 0}</style>
    </head>
    <body>
      <h2>${t.medicalRecords.prescription}</h2>
      <p><strong>${t.medicalRecords.medicineName}:</strong> ${prescription.medicineName}</p>
      <p><strong>${t.medicalRecords.dosage}:</strong> ${prescription.dosage}</p>
      <p><strong>${t.medicalRecords.duration}:</strong> ${prescription.duration}</p>
      ${prescription.instructions ? `<p><strong>${t.medicalRecords.instructions}:</strong> ${prescription.instructions}</p>` : ''}
      <p style="margin-top:24px;color:#888;font-size:12px">${t.common.date}: ${new Date(prescription.createdAt).toLocaleDateString('uz-UZ')}</p>
    </body>
    </html>
  `;
  const win = window.open('', '_blank');
  win?.document.write(printContent);
  win?.print();
  win?.close();
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function paymentStatusClass(status: string): string {
  switch (status) {
    case 'PAID': return 'bg-green-100 text-green-800';
    case 'PARTIAL': return 'bg-yellow-100 text-yellow-800';
    case 'PENDING': return 'bg-slate-100 text-slate-800';
    case 'CANCELLED': return 'bg-red-100 text-red-800';
    case 'REFUNDED': return 'bg-blue-100 text-blue-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = 'info' | 'records' | 'payments';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PatientDetailPage({ params }: PageProps) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();

  const [patientId, setPatientId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('info');

  // ── Patient state ──────────────────────────────────────────────────────────
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Medical records state ──────────────────────────────────────────────────
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

  // ── Add record modal ───────────────────────────────────────────────────────
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [recordForm, setRecordForm] = useState({
    doctorId: '',
    diagnosis: '',
    treatment: '',
    notes: '',
  });
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordFormError, setRecordFormError] = useState<string | null>(null);

  // ── Add prescription modal ─────────────────────────────────────────────────
  const [prescriptionTarget, setPrescriptionTarget] = useState<string | null>(null);
  const [prescriptionForm, setPrescriptionForm] = useState({
    medicineName: '',
    dosage: '',
    duration: '',
    instructions: '',
  });
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [prescriptionFormError, setPrescriptionFormError] = useState<string | null>(null);

  // ── Payments state ─────────────────────────────────────────────────────────
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN';
  const isDoctor =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'HEAD_DOCTOR' ||
    session?.user?.role === 'DOCTOR';

  // ── Resolve params ─────────────────────────────────────────────────────────
  useEffect(() => {
    params.then((p) => setPatientId(p.id));
  }, [params]);

  // ── Fetch patient ──────────────────────────────────────────────────────────
  const fetchPatient = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}`);
      if (res.status === 404) { setError(t.patients.notFound); return; }
      if (!res.ok) throw new Error(t.common.error);
      const data: Patient = await res.json();
      setPatient(data);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [patientId, t.patients.notFound, t.common.error]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  // ── Fetch records ──────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    if (!patientId) return;
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await fetch(`/api/medical-records?patientId=${patientId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : (data.data ?? []));
    } catch {
      setRecordsError(t.common.error);
    } finally {
      setRecordsLoading(false);
    }
  }, [patientId, t.common.error]);

  // ── Fetch doctors ──────────────────────────────────────────────────────────
  const fetchDoctors = useCallback(async () => {
    try {
      const [resDoctor, resHeadDoctor] = await Promise.all([
        fetch('/api/staff?role=DOCTOR'),
        fetch('/api/staff?role=HEAD_DOCTOR'),
      ]);
      const doctorData = resDoctor.ok ? await resDoctor.json() : [];
      const headDoctorData = resHeadDoctor.ok ? await resHeadDoctor.json() : [];
      const combined = [
        ...(Array.isArray(doctorData) ? doctorData : (doctorData.data ?? [])),
        ...(Array.isArray(headDoctorData) ? headDoctorData : (headDoctorData.data ?? [])),
      ];
      setDoctors(combined);
    } catch {
      // silent
    }
  }, []);

  // ── Fetch payments ─────────────────────────────────────────────────────────
  const fetchPayments = useCallback(async () => {
    if (!patientId) return;
    setPaymentsLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/payments`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : (data.data ?? []));
    } catch {
      // silent
    } finally {
      setPaymentsLoading(false);
    }
  }, [patientId]);

  // ── Load tab data on switch ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'records' && patientId) {
      fetchRecords();
      if (isDoctor) fetchDoctors();
    }
    if (activeTab === 'payments' && patientId) {
      fetchPayments();
    }
  }, [activeTab, patientId, isDoctor, fetchRecords, fetchDoctors, fetchPayments]);

  // ── Patient edit handlers ──────────────────────────────────────────────────
  const handleEdit = () => {
    if (!patient) return;
    setForm(patientToForm(patient));
    setSaveError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setForm(null);
    setSaveError(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => prev ? { ...prev, [e.target.name]: e.target.value } : prev);
  };

  const handleSave = async () => {
    if (!form || !patient) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, string | null> = {
        firstName: form.firstName,
        lastName: form.lastName,
        fatherName: form.fatherName,
        phone: form.phone,
        jshshir: form.jshshir,
        birthDate: form.birthDate,
        district: form.district || null,
        houseNumber: form.houseNumber || null,
        medicalHistory: form.medicalHistory || null,
        allergies: form.allergies || null,
        telegramChatId: form.telegramChatId || null,
      };
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || t.common.error); }
      const updated: Patient = await res.json();
      setPatient(updated);
      setEditing(false);
      setForm(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!patient) return;
    if (!confirm(t.patients.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/patients/${patient.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t.common.error);
      router.push('/patients');
    } catch {
      setError(t.common.error);
    }
  };

  // ── Record handlers ────────────────────────────────────────────────────────
  const openRecordModal = () => {
    setRecordForm({ doctorId: '', diagnosis: '', treatment: '', notes: '' });
    setRecordFormError(null);
    setShowRecordModal(true);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    setSavingRecord(true);
    setRecordFormError(null);
    try {
      const res = await fetch('/api/medical-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, ...recordForm }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || t.common.error); }
      setShowRecordModal(false);
      fetchRecords();
    } catch (err) {
      setRecordFormError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSavingRecord(false);
    }
  };

  // ── Prescription handlers ──────────────────────────────────────────────────
  const openPrescriptionModal = (recordId: string) => {
    setPrescriptionTarget(recordId);
    setPrescriptionForm({ medicineName: '', dosage: '', duration: '', instructions: '' });
    setPrescriptionFormError(null);
  };

  const handlePrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescriptionTarget) return;
    setSavingPrescription(true);
    setPrescriptionFormError(null);
    try {
      const res = await fetch(`/api/medical-records/${prescriptionTarget}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prescriptionForm),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || t.common.error); }
      setPrescriptionTarget(null);
      fetchRecords();
    } catch (err) {
      setPrescriptionFormError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSavingPrescription(false);
    }
  };

  const toggleRecord = (id: string) => {
    setExpandedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/patients')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.common.back}
        </button>
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error ?? t.patients.notFound}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/patients')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.common.back}
        </button>

        {activeTab === 'info' && (
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  {t.common.edit}
                </button>
                {isAdmin && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-sm font-medium rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t.common.delete}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                >
                  <X className="w-4 h-4" />
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t.common.save}
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'records' && isDoctor && (
          <button
            onClick={openRecordModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.medicalRecords.addRecord}
          </button>
        )}
      </div>

      {/* Patient header card */}
      <div className="bg-white rounded-2xl border border-slate-200 mb-5 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-slate-50 px-6 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {patient.lastName} {patient.firstName} {patient.fatherName}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              ID: {patient.id.slice(0, 8)}... &nbsp;|&nbsp;
              {new Date(patient.birthDate).toLocaleDateString('uz-UZ')}&nbsp;
              ({t.patients.age}: {calcAge(patient.birthDate)})
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {(['info', 'records', 'payments'] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = {
              info: t.medicalRecords.tabInfo,
              records: t.medicalRecords.tabRecords,
              payments: t.medicalRecords.tabPayments,
            };
            return (
              <button
                key={tab}
                onClick={() => { setEditing(false); setForm(null); setActiveTab(tab); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB: Info ────────────────────────────────────────────────────────── */}
      {activeTab === 'info' && (
        <>
          {saveError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {saveError}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField
                icon={<Phone className="w-4 h-4 text-slate-400" />}
                label={t.common.phone}
                editing={editing}
                value={patient.phone}
                editNode={
                  <input name="phone" value={form?.phone ?? ''} onChange={handleFormChange}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                }
              />

              <InfoField
                icon={<Hash className="w-4 h-4 text-slate-400" />}
                label={t.patients.jshshir}
                editing={editing}
                value={patient.jshshir}
                valueClass="font-mono"
                editNode={
                  <input name="jshshir" value={form?.jshshir ?? ''} onChange={handleFormChange} maxLength={14}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                }
              />

              <InfoField
                icon={<Calendar className="w-4 h-4 text-slate-400" />}
                label={t.patients.birthDate}
                editing={editing}
                value={`${new Date(patient.birthDate).toLocaleDateString('uz-UZ')} (${t.patients.age}: ${calcAge(patient.birthDate)})`}
                editNode={
                  <input type="date" name="birthDate" value={form?.birthDate ?? ''} onChange={handleFormChange}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                }
              />

              {patient.gender && (
                <InfoField
                  icon={<User className="w-4 h-4 text-slate-400" />}
                  label={t.patients.gender}
                  editing={false}
                  value={patient.gender === 'MALE' ? t.patients.male : patient.gender === 'FEMALE' ? t.patients.female : patient.gender}
                  editNode={null}
                />
              )}

              {patient.bloodType && (
                <InfoField
                  icon={<Droplets className="w-4 h-4 text-slate-400" />}
                  label={t.patients.bloodType}
                  editing={false}
                  value={patient.bloodType}
                  editNode={null}
                />
              )}

              <InfoField
                icon={<MapPin className="w-4 h-4 text-slate-400" />}
                label={t.patients.district}
                editing={editing}
                value={patient.district ?? '—'}
                editNode={
                  <input name="district" value={form?.district ?? ''} onChange={handleFormChange}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                }
              />

              <InfoField
                icon={<MapPin className="w-4 h-4 text-slate-400" />}
                label={t.patients.houseNumber}
                editing={editing}
                value={patient.houseNumber ?? '—'}
                editNode={
                  <input name="houseNumber" value={form?.houseNumber ?? ''} onChange={handleFormChange}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                }
              />

              <InfoField
                icon={<MessageCircle className="w-4 h-4 text-slate-400" />}
                label={t.patients.telegramChatId}
                editing={editing}
                value={patient.telegramChatId ?? '—'}
                editNode={
                  <input name="telegramChatId" value={form?.telegramChatId ?? ''} onChange={handleFormChange}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                }
              />

              <div className="md:col-span-2">
                <InfoField
                  icon={<AlertTriangle className="w-4 h-4 text-slate-400" />}
                  label={t.patients.allergies}
                  editing={editing}
                  value={patient.allergies ?? '—'}
                  editNode={
                    <textarea name="allergies" value={form?.allergies ?? ''} onChange={handleFormChange} rows={2}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  }
                />
              </div>

              <div className="md:col-span-2">
                <InfoField
                  icon={<FileText className="w-4 h-4 text-slate-400" />}
                  label={t.patients.medicalHistory}
                  editing={editing}
                  value={patient.medicalHistory ?? '—'}
                  editNode={
                    <textarea name="medicalHistory" value={form?.medicalHistory ?? ''} onChange={handleFormChange} rows={4}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  }
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex gap-6">
              <span>{t.common.createdAt}: {new Date(patient.createdAt).toLocaleString('uz-UZ')}</span>
              <span>{t.common.updatedAt}: {new Date(patient.updatedAt).toLocaleString('uz-UZ')}</span>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: Medical Records ─────────────────────────────────────────────── */}
      {activeTab === 'records' && (
        <div>
          {recordsError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {recordsError}
            </div>
          )}
          {recordsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center text-slate-400 text-sm">
              {t.medicalRecords.noRecords}
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => {
                const expanded = expandedRecords.has(record.id);
                return (
                  <div key={record.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {/* Record header */}
                    <div
                      className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => toggleRecord(record.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{record.doctor?.name ?? '—'}</p>
                          <p className="text-xs text-slate-500">{record.doctor?.role ?? ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          {new Date(record.createdAt).toLocaleDateString('uz-UZ')}
                        </span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Record body */}
                    {expanded && (
                      <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <RecordField label={t.medicalRecords.diagnosis} value={record.diagnosis ?? '—'} />
                          <RecordField label={t.medicalRecords.treatment} value={record.treatment ?? '—'} />
                          <RecordField label={t.medicalRecords.notes} value={record.notes ?? '—'} />
                        </div>

                        {/* Prescriptions */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-700">{t.medicalRecords.prescriptions}</h4>
                            {isDoctor && (
                              <button
                                onClick={() => openPrescriptionModal(record.id)}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                {t.medicalRecords.addPrescription}
                              </button>
                            )}
                          </div>

                          {record.prescriptions.length === 0 ? (
                            <p className="text-sm text-slate-400">{t.medicalRecords.noPrescriptions}</p>
                          ) : (
                            <div className="space-y-2">
                              {record.prescriptions.map((rx) => (
                                <div key={rx.id} className="flex items-start justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                    <div>
                                      <span className="text-xs text-slate-400 block">{t.medicalRecords.medicineName}</span>
                                      <span className="font-medium text-slate-800">{rx.medicineName}</span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-slate-400 block">{t.medicalRecords.dosage}</span>
                                      <span className="text-slate-700">{rx.dosage}</span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-slate-400 block">{t.medicalRecords.duration}</span>
                                      <span className="text-slate-700">{rx.duration}</span>
                                    </div>
                                    {rx.instructions && (
                                      <div>
                                        <span className="text-xs text-slate-400 block">{t.medicalRecords.instructions}</span>
                                        <span className="text-slate-700">{rx.instructions}</span>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handlePrint(rx, t)}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors ml-3 flex-shrink-0"
                                  >
                                    <Printer className="w-3 h-3" />
                                    {t.medicalRecords.printPrescription}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Payments ────────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : payments.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400 text-sm">
              {t.medicalRecords.noPayments}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.common.date}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.payments.amount}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.payments.method}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.payments.category}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(pay.createdAt).toLocaleDateString('uz-UZ')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {formatCurrency(pay.amount, t.common?.sum ?? "so'm")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {(t.payments.methods as Record<string, string>)[pay.method] ?? pay.method}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {(t.payments.categories as Record<string, string>)[pay.category] ?? pay.category}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusClass(pay.status)}`}>
                          {(t.payments.statuses as Record<string, string>)[pay.status] ?? pay.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Add Medical Record ─────────────────────────────────────────── */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{t.medicalRecords.addRecord}</h2>
              <button onClick={() => setShowRecordModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordSubmit} className="p-6 space-y-4">
              {recordFormError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {recordFormError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.medicalRecords.doctor} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={recordForm.doctorId}
                  onChange={(e) => setRecordForm((p) => ({ ...p, doctorId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t.medicalRecords.selectDoctor}</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.medicalRecords.diagnosis}</label>
                <textarea
                  rows={3}
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm((p) => ({ ...p, diagnosis: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.medicalRecords.treatment}</label>
                <textarea
                  rows={3}
                  value={recordForm.treatment}
                  onChange={(e) => setRecordForm((p) => ({ ...p, treatment: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.medicalRecords.notes}</label>
                <textarea
                  rows={2}
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm((p) => ({ ...p, notes: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={savingRecord}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                  {savingRecord && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Prescription ───────────────────────────────────────────── */}
      {prescriptionTarget && isDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{t.medicalRecords.addPrescription}</h2>
              <button onClick={() => setPrescriptionTarget(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePrescriptionSubmit} className="p-6 space-y-4">
              {prescriptionFormError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {prescriptionFormError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.medicalRecords.medicineName} <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={prescriptionForm.medicineName}
                  onChange={(e) => setPrescriptionForm((p) => ({ ...p, medicineName: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.medicalRecords.dosage} <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={prescriptionForm.dosage}
                  onChange={(e) => setPrescriptionForm((p) => ({ ...p, dosage: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.medicalRecords.duration} <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={prescriptionForm.duration}
                  onChange={(e) => setPrescriptionForm((p) => ({ ...p, duration: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.medicalRecords.instructions}</label>
                <textarea
                  rows={3}
                  value={prescriptionForm.instructions}
                  onChange={(e) => setPrescriptionForm((p) => ({ ...p, instructions: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setPrescriptionTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={savingPrescription}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                  {savingPrescription && <Loader2 className="w-4 h-4 animate-spin" />}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InfoFieldProps {
  icon: React.ReactNode;
  label: string;
  editing: boolean;
  value: string;
  valueClass?: string;
  editNode: React.ReactNode;
}

function InfoField({ icon, label, editing, value, valueClass = '', editNode }: InfoFieldProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      {editing ? editNode : <p className={`text-sm text-slate-800 ${valueClass}`}>{value}</p>}
    </div>
  );
}

function RecordField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">{label}</span>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}
