'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { Modal } from '../ui';

// --- Local types --------------------------------------------------------------

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
  chronicConditions: string;
  telegramChatId: string;
}

interface EditPatientModalPatient {
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  jshshir: string;
  birthDate: string;
  district: string | null;
  houseNumber: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  telegramChatId: string | null;
}

interface EditPatientModalProps {
  open: boolean;
  patient: EditPatientModalPatient;
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPatientModal({
  open,
  patient,
  patientId,
  onClose,
  onSaved,
}: EditPatientModalProps) {
  const { t } = useLanguage();
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (!open) return;
    setEditForm({
      firstName: patient.firstName,
      lastName: patient.lastName,
      fatherName: patient.fatherName,
      phone: patient.phone,
      jshshir: patient.jshshir ?? '',
      birthDate: new Date(patient.birthDate).getFullYear().toString(),
      district: patient.district ?? '',
      houseNumber: patient.houseNumber ?? '',
      medicalHistory: patient.medicalHistory ?? '',
      allergies: patient.allergies ?? '',
      chronicConditions: patient.chronicConditions ?? '',
      telegramChatId: patient.telegramChatId ?? '',
    });
    setSaveError(null);
  }, [open, patient]);

  const saveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          birthDate: editForm.birthDate?.length === 4
            ? `${editForm.birthDate}-01-01`
            : (editForm.birthDate || undefined),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !editForm) return null;

  return (
    <Modal title={t.patients.editPatient} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        {([
          ['lastName', 'Familiya'],
          ['firstName', 'Ism'],
          ['fatherName', 'Otasining ismi'],
          ['phone', 'Telefon'],
          ['jshshir', 'JSHSHIR'],
          ['birthDate', 'Tug\'ilgan yil'],
          ['district', 'Tuman'],
          ['houseNumber', 'Uy raqami'],
          ['telegramChatId', 'Telegram Chat ID'],
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
          <textarea
            value={editForm.allergies}
            onChange={e => setEditForm(f => f ? { ...f, allergies: e.target.value } : f)}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Surunkali kasalliklar</label>
          <textarea
            value={editForm.chronicConditions}
            onChange={e => setEditForm(f => f ? { ...f, chronicConditions: e.target.value } : f)}
            rows={2}
            placeholder="Diabet, gipertoniya, astma..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Tibbiy tarix</label>
          <textarea
            value={editForm.medicalHistory}
            onChange={e => setEditForm(f => f ? { ...f, medicalHistory: e.target.value } : f)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      {saveError && <p className="text-red-600 text-sm mt-3">{saveError}</p>}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
        >
          <X className="w-4 h-4 inline mr-1" /> {t.common.cancel}
        </button>
        <button
          onClick={saveEdit}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {t.common.save}
        </button>
      </div>
    </Modal>
  );
}
