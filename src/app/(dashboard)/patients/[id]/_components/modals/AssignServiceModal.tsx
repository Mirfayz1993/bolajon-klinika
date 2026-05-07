'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { floorLabel } from '@/lib/utils';

// --- Types --------------------------------------------------------------------

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

interface AmbRoom {
  id: string;
  roomNumber: string;
  floor: number;
  beds: { id: string; admissions: { id: string }[] }[];
}

interface AmbBed {
  id: string;
  bedNumber: string;
  status: string;
}

interface StaffLite {
  id: string;
  name: string;
  role: string;
}

interface PatientLite {
  id: string;
}

interface AdmissionLite {
  id: string;
  admissionType: string;
  status: string;
  dischargeDate?: string | null;
  bed: { bedNumber: string; room: { floor: number; roomNumber: string; type: string } };
}

interface ProfileLite {
  admissions: AdmissionLite[];
}

export interface AssignServiceModalProps {
  open: boolean;
  patientId: string;
  patient: PatientLite;
  profile: ProfileLite;
  canSeePrices: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// --- Helpers ------------------------------------------------------------------

function fmtMoney(amount: number) {
  return amount.toLocaleString('uz-UZ') + ' so\'m';
}

// --- Component ----------------------------------------------------------------

export function AssignServiceModal(props: AssignServiceModalProps) {
  const { open, patientId, profile, onClose, onSaved } = props;
  // `patient` va `canSeePrices` props.AssignServiceModalProps interface'ida e'lon
  // qilingan (spec talabi), lekin modal joriy implementatsiyasida ishlatilmaydi —
  // narx har doim ko'rinadi (asl page.tsx bilan bir xil xulq), patient ID
  // patientId orqali keladi.
  void props.patient;
  void props.canSeePrices;
  // Service category & item
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryData[]>([]);
  const [assignCatId, setAssignCatId] = useState('');
  const [assignItemId, setAssignItemId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  // Doctor / staff selection
  const [assignDoctorId, setAssignDoctorId] = useState('');
  const [assignIsUrgent, setAssignIsUrgent] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState('');
  const [doctorList, setDoctorList] = useState<StaffLite[]>([]);
  const [allStaffList, setAllStaffList] = useState<StaffLite[]>([]);

  // Lab test types (for lab category)
  const [labTestTypes, setLabTestTypes] = useState<ServiceCategoryItem[]>([]);

  // Ambulatory room/bed
  const [ambRooms, setAmbRooms] = useState<AmbRoom[]>([]);
  const [ambRoomId, setAmbRoomId] = useState('');
  const [ambBeds, setAmbBeds] = useState<AmbBed[]>([]);
  const [ambBedId, setAmbBedId] = useState('');
  const [ambBedsLoading, setAmbBedsLoading] = useState(false);
  const [recommendedBed, setRecommendedBed] = useState<{ roomId: string | null; bedId: string | null } | null>(null);

  // Derived
  const assignCat = serviceCategories.find(c => c.id === assignCatId);
  const isLabCat = assignCat
    ? ['lab', 'laboratoriya', 'labaratoriya', 'tahlil'].some(k => assignCat.name.toLowerCase().includes(k))
    : false;
  const isDoctorCat = assignCat
    ? ['doktor', 'ko\'rik', 'korik', 'checkup', 'qabul', 'shifokor'].some(k => assignCat.name.toLowerCase().includes(k))
    : false;
  const isAmbulatoryCat = assignCat ? assignCat.name.toLowerCase().includes('ambulator') : false;
  const visibleItems: ServiceCategoryItem[] = isLabCat ? labTestTypes : (assignCat?.items ?? []);
  const assignItem = visibleItems.find(i => i.id === assignItemId);

  // Reset state when modal closes
  const resetAll = () => {
    setAssignCatId('');
    setAssignItemId('');
    setAssignDoctorId('');
    setAssignIsUrgent(false);
    setAssignStaffId('');
    setAmbRoomId('');
    setAmbBedId('');
    setAmbBeds([]);
    setAmbRooms([]);
    setRecommendedBed(null);
  };

  // 1) Modal ochilganda — service categories + ambulatory rooms + recommendedBed (atomik)
  useEffect(() => {
    if (!open) return;
    // Round-robin: rooms va recommendedBed ni atomik (Promise.all) yuklaymiz —
    // race condition'ning oldini olish uchun setAmbRooms va setRecommendedBed
    // bir vaqtda ketma-ket o'rnatiladi, useEffect qayta-qayta trigger bo'lmaydi.
    Promise.all([
      fetch('/api/rooms?isAmbulatory=true').then(r => r.ok ? r.json() : []),
      fetch('/api/rooms/next-ambulatory-bed').then(r => r.ok ? r.json() : null),
    ])
      .then(([roomsData, rec]: [unknown, { roomId: string | null; bedId: string | null } | null]) => {
        const all = Array.isArray(roomsData)
          ? (roomsData as AmbRoom[])
          : (((roomsData as { data?: AmbRoom[] } | null)?.data) ?? []);
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

    // service categories — keshlangan bo'lsa qayta yuklamaymiz
    if (serviceCategories.length === 0) {
      fetch('/api/service-categories')
        .then(r => r.ok ? r.json() : [])
        .then(d => setServiceCategories(Array.isArray(d) ? d : (d.data ?? [])))
        .catch(() => null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Lab kategoriya tanlanganda — lab-test-types
  useEffect(() => {
    if (!isLabCat) return;
    fetch('/api/lab-test-types')
      .then(r => r.json())
      .then(d => setLabTestTypes(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setLabTestTypes([]));
  }, [isLabCat]);

  // 3) Doktor kategoriya tanlanganda — doctorList
  useEffect(() => {
    if (!isDoctorCat) return;
    if (doctorList.length > 0) return;
    fetch('/api/staff?role=DOCTOR&role=HEAD_DOCTOR')
      .then(r => r.json())
      .then(d => setDoctorList((d.data ?? d).filter((u: { isActive: boolean }) => u.isActive)))
      .catch(() => null);
  }, [isDoctorCat, doctorList.length]);

  // 4) Modal ochilganda — barcha xodimlar (xizmat tayinlash uchun)
  useEffect(() => {
    if (!open || allStaffList.length > 0) return;
    fetch('/api/staff')
      .then(r => r.json())
      .then(d => setAllStaffList((d.data ?? d).filter((u: { isActive: boolean }) => u.isActive)))
      .catch(() => null);
  }, [open, allStaffList.length]);

  // 5) Ambulator beds — xona o'zgarganda server tavsiyasiga asosan to'shak avtomatik tanlanadi
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

  const handleClose = () => {
    resetAll();
    onClose();
  };

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
      resetAll();
      onSaved();
      onClose();
    } finally { setAssignSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Xizmat tayinlash</h3>
          <button type="button" onClick={handleClose}>
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
            onClick={handleClose}
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
  );
}
