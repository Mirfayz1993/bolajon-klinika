'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Modal } from '../ui';

// --- Local types --------------------------------------------------------------

interface NurseMedicine {
  name: string;
  quantity: number;
  unit: string;
}

interface NurseForm {
  procedure: string;
  notes: string;
  admissionId: string;
  noteType: string;
  medicines: NurseMedicine[];
}

interface NurseNoteModalProps {
  patientId: string;
  defaultNoteType: string;
  onClose: () => void;
  onSaved: () => void;
}

export function NurseNoteModal({ patientId, defaultNoteType, onClose, onSaved }: NurseNoteModalProps) {
  const [nurseForm, setNurseForm] = useState<NurseForm>({
    procedure: '',
    notes: '',
    admissionId: '',
    noteType: defaultNoteType,
    medicines: [],
  });
  const [savingNote, setSavingNote] = useState(false);

  // -- Medicine row helpers --------------------------------------------------
  const addMedicineRow = () =>
    setNurseForm(f => ({ ...f, medicines: [...f.medicines, { name: '', quantity: 1, unit: 'ml' }] }));

  const updateMedicine = (idx: number, field: string, value: string | number) =>
    setNurseForm(f => ({
      ...f,
      medicines: f.medicines.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }));

  const removeMedicine = (idx: number) =>
    setNurseForm(f => ({ ...f, medicines: f.medicines.filter((_, i) => i !== idx) }));

  // Helpers preserved for future medicine UI; intentionally referenced to
  // avoid unused-var noise without changing current behavior.
  void addMedicineRow;
  void updateMedicine;
  void removeMedicine;

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
      onClose();
      onSaved();
    } finally { setSavingNote(false); }
  };

  return (
    <Modal title={nurseForm.noteType === 'AMBULATORY' ? "Ambulator qayd qo'shish" : "Hamshira qaydini qo'shish"} onClose={onClose}>
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
        <button onClick={onClose}
          className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm">
          Bekor qilish
        </button>
        <button onClick={saveNurseNote} disabled={savingNote || !nurseForm.procedure.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm disabled:opacity-60">
          {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Saqlash
        </button>
      </div>
    </Modal>
  );
}
