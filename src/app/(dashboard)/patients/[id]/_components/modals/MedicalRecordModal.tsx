'use client';

import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Modal } from '../ui';
import { printPrescriptions } from '../../_lib/print-templates';

// --- Local prop types ---------------------------------------------------------

interface MedicalRecordPatient {
  firstName: string;
  lastName: string;
  fatherName: string;
  birthDate: string;
}

interface MedicalRecordModalProps {
  patientId: string;
  doctorId: string | undefined;
  patient: MedicalRecordPatient;
  onClose: () => void;
  onSaved: () => void;
}

interface PrescriptionRow {
  medicineName: string;
  dosage: string;
  duration: string;
  instructions: string;
}

interface RecordForm {
  diagnosis: string;
  treatment: string;
  notes: string;
  prescriptions: PrescriptionRow[];
}

export function MedicalRecordModal({ patientId, doctorId, patient, onClose, onSaved }: MedicalRecordModalProps) {
  const [recordForm, setRecordForm] = useState<RecordForm>({
    diagnosis: '',
    treatment: '',
    notes: '',
    prescriptions: [],
  });
  const [savingRecord, setSavingRecord] = useState(false);

  const saveRecord = async () => {
    if (!recordForm.diagnosis.trim() && !recordForm.treatment.trim() && !recordForm.notes.trim()) return;
    setSavingRecord(true);
    try {
      const res = await fetch('/api/medical-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorId,
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
      if (rxList.length > 0) {
        printPrescriptions(patient, rxList);
      }

      onClose();
      setRecordForm({ diagnosis: '', treatment: '', notes: '', prescriptions: [] });
      onSaved();
    } catch { /* ignore */ } finally {
      setSavingRecord(false);
    }
  };

  return (
    <Modal title="Tashxis qo'shish" onClose={onClose}>
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
        <button onClick={onClose}
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
  );
}
