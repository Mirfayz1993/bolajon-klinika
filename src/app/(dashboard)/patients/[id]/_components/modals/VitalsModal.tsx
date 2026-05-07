'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface VitalsModalProps {
  admissionId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function VitalsModal({ admissionId, onClose, onSaved }: VitalsModalProps) {
  const [vitalsForm, setVitalsForm] = useState({
    temperature: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    pulse: '',
    oxygenSaturation: '',
    weight: '',
    notes: '',
  });
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsError, setVitalsError] = useState<string | null>(null);

  const handleClose = () => {
    setVitalsError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVitals(true);
    setVitalsError(null);
    try {
      const body: Record<string, number | string | undefined> = {};
      if (vitalsForm.temperature) body.temperature = parseFloat(vitalsForm.temperature);
      if (vitalsForm.bloodPressureSystolic) body.bloodPressureSystolic = parseInt(vitalsForm.bloodPressureSystolic);
      if (vitalsForm.bloodPressureDiastolic) body.bloodPressureDiastolic = parseInt(vitalsForm.bloodPressureDiastolic);
      if (vitalsForm.pulse) body.pulse = parseInt(vitalsForm.pulse);
      if (vitalsForm.oxygenSaturation) body.oxygenSaturation = parseFloat(vitalsForm.oxygenSaturation);
      if (vitalsForm.weight) body.weight = parseFloat(vitalsForm.weight);
      if (vitalsForm.notes) body.notes = vitalsForm.notes;
      const res = await fetch(`/api/admissions/${admissionId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Xatolik');
      }
      setVitalsForm({
        temperature: '', bloodPressureSystolic: '', bloodPressureDiastolic: '',
        pulse: '', oxygenSaturation: '', weight: '', notes: '',
      });
      onSaved();
      onClose();
    } catch (err) {
      setVitalsError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSavingVitals(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Ko&apos;rsatkichlarni kiritish</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {vitalsError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{vitalsError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Harorat (°C)</label>
              <input
                type="number"
                step="0.1"
                value={vitalsForm.temperature}
                onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))}
                placeholder="36.6"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Puls (urish/daqiqa)</label>
              <input
                type="number"
                value={vitalsForm.pulse}
                onChange={e => setVitalsForm(f => ({ ...f, pulse: e.target.value }))}
                placeholder="72"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bosim sistolik (mmHg)</label>
              <input
                type="number"
                value={vitalsForm.bloodPressureSystolic}
                onChange={e => setVitalsForm(f => ({ ...f, bloodPressureSystolic: e.target.value }))}
                placeholder="120"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bosim diastolik (mmHg)</label>
              <input
                type="number"
                value={vitalsForm.bloodPressureDiastolic}
                onChange={e => setVitalsForm(f => ({ ...f, bloodPressureDiastolic: e.target.value }))}
                placeholder="80"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SpO2 (%)</label>
              <input
                type="number"
                step="0.1"
                value={vitalsForm.oxygenSaturation}
                onChange={e => setVitalsForm(f => ({ ...f, oxygenSaturation: e.target.value }))}
                placeholder="98"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vazn (kg)</label>
              <input
                type="number"
                step="0.1"
                value={vitalsForm.weight}
                onChange={e => setVitalsForm(f => ({ ...f, weight: e.target.value }))}
                placeholder="70"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Izoh</label>
            <textarea
              value={vitalsForm.notes}
              onChange={e => setVitalsForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Qo'shimcha kuzatuvlar..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
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
              disabled={savingVitals}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingVitals && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
