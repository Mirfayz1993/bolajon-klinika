'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { printQr, printReceipt } from './_lib/print-templates';
import { calcAge, fmt, fmtDate, fmtMoney } from './_lib/format';
import { APPT_TYPE_LABELS, APPT_STATUS_COLORS } from './_lib/labels';
import type {
  Patient,
  AssignedService,
  ProfileData,
} from './_lib/types';
import { InfoTab } from './_components/InfoTab';
import { ServicesTab } from './_components/ServicesTab';
import { RecordsTab } from './_components/RecordsTab';
import { NurseTab } from './_components/NurseTab';
import { LabTab } from './_components/LabTab';
import { InpatientTab } from './_components/InpatientTab';
import { PatientHeader } from './_components/PatientHeader';
import { TabsNav, type TabItem } from './_components/TabsNav';
import { MedicalRecordModal } from './_components/modals/MedicalRecordModal';
import { NurseNoteModal } from './_components/modals/NurseNoteModal';
import { LabOrderModal } from './_components/modals/LabOrderModal';
import { PayModal } from './_components/modals/PayModal';
import { BulkPayModal } from './_components/modals/BulkPayModal';
import { AssignServiceModal } from './_components/modals/AssignServiceModal';
import { QrModal } from './_components/modals/QrModal';
import { EditPatientModal } from './_components/modals/EditPatientModal';
import {
  Loader2, AlertCircle,
  User,
  Stethoscope, CreditCard, FlaskConical, BedDouble, ClipboardList,
} from 'lucide-react';

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

  const tabs: TabItem<Tab>[] = [
    { key: 'info' as Tab, label: pt.tabs?.general ?? 'Umumiy', icon: <User className="w-4 h-4" /> },
    { key: 'services' as Tab, label: pt.tabs?.services ?? 'Xizmatlar', icon: <CreditCard className="w-4 h-4" />, count: assignedServices.length, requires: '/patients:tab:xizmatlar' },
    { key: 'records' as Tab, label: pt.tabs?.records ?? 'Tashxislar', icon: <Stethoscope className="w-4 h-4" />, count: medicalRecords.length, requires: '/patients:tab:tashxislar' },
    { key: 'nurse' as Tab, label: pt.tabs?.nurse ?? 'Hamshira', icon: <ClipboardList className="w-4 h-4" />, count: nurseNotes.length, requires: '/patients:tab:hamshira' },
    { key: 'lab' as Tab, label: pt.tabs?.lab ?? 'Laboratoriya', icon: <FlaskConical className="w-4 h-4" />, count: labTests.length, requires: '/patients:tab:laboratoriya' },
    ...(activeAdmission ? [{ key: 'inpatient' as Tab, label: 'Statsionar', icon: <BedDouble className="w-4 h-4" />, requires: '/patients:tab:statsionar' }] : []),
  ].filter(tab => !tab.requires || can(tab.requires));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header + Patient card */}
      <PatientHeader
        patient={patient}
        totalPaid={totalPaid}
        paymentsCount={payments.length}
        pt={pt}
        fromQueue={fromQueue}
        fromAmbulatory={fromAmbulatory}
        isAdmin={isAdmin}
        canSeePrices={canSeePrices}
        calcAge={calcAge}
        fmtDate={fmtDate}
        fmtMoney={fmtMoney}
        onBack={() => router.push('/patients')}
        onBackToQueue={() => router.push('/doctor-queue')}
        onBackToAmbulatory={() => router.push('/ambulatory')}
        onQrClick={openQr}
        onEditClick={() => setEditing(true)}
        onDeleteClick={handleDelete}
      />

      {/* Tabs */}
      <TabsNav activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />

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
      <QrModal
        open={showQr}
        patient={patient}
        qrDataUrl={qrDataUrl}
        qrLoading={qrLoading}
        canPrintQr={canPrintQr}
        onClose={() => setShowQr(false)}
        onPrint={() => profile && printQr({ patient: profile.patient, qrDataUrl })}
      />

      {/* -- Edit Modal ------------------------------------------------------ */}
      <EditPatientModal
        open={editing}
        patient={patient}
        patientId={patientId}
        onClose={() => setEditing(false)}
        onSaved={fetchProfile}
      />

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


