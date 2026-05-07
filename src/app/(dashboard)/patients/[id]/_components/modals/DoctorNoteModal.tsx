'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface DoctorNoteModalProps {
  admissionId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function DoctorNoteModal({ admissionId, onClose, onSaved }: DoctorNoteModalProps) {
  const [noteForm, setNoteForm] = useState({ diagnosis: '', treatment: '', notes: '' });
  const [savingInpatientNote, setSavingInpatientNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const handleClose = () => {
    setNoteError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInpatientNote(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/admissions/${admissionId}/doctor-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Xatolik');
      }
      setNoteForm({ diagnosis: '', treatment: '', notes: '' });
      onSaved();
      onClose();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSavingInpatientNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Kunlik ko&apos;rik qaydı</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {noteError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{noteError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tashxis</label>
            <input
              value={noteForm.diagnosis}
              onChange={e => setNoteForm(f => ({ ...f, diagnosis: e.target.value }))}
              placeholder="Masalan: O'tkir bronxit"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Muolaja</label>
            <input
              value={noteForm.treatment}
              onChange={e => setNoteForm(f => ({ ...f, treatment: e.target.value }))}
              placeholder="Masalan: Ampisillin 2x1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Izohlar</label>
            <textarea
              value={noteForm.notes}
              onChange={e => setNoteForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Bemorning holati, kuzatuvlar..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Bekor
            </button>
            <button
              type="submit"
              disabled={savingInpatientNote}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingInpatientNote && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
