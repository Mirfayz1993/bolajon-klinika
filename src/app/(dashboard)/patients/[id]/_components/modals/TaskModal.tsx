'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

// --- Local types --------------------------------------------------------------

interface NurseOption {
  id: string;
  name: string;
  role: string;
}

interface TaskModalProps {
  admissionId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function TaskModal({ admissionId, onClose, onSaved }: TaskModalProps) {
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigneeId: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [nurseList, setNurseList] = useState<NurseOption[]>([]);

  // Lazy fetch nurses when modal mounts
  useEffect(() => {
    fetch('/api/staff?role=NURSE,HEAD_NURSE')
      .then(r => r.json())
      .then(d => setNurseList((d.data ?? d).filter((u: { isActive: boolean }) => u.isActive)))
      .catch(() => null);
  }, []);

  const handleClose = () => {
    setTaskError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTask(true);
    setTaskError(null);
    try {
      const res = await fetch(`/api/admissions/${admissionId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Xatolik');
      }
      setTaskForm({ title: '', description: '', assigneeId: '' });
      onSaved();
      onClose();
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Yangi muolaja buyurtmasi</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {taskError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{taskError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Muolaja nomi <span className="text-red-500">*</span>
            </label>
            <input
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              required
              placeholder="Masalan: Ampisillin 500mg ukoli"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Izoh</label>
            <textarea
              value={taskForm.description}
              onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Qo'shimcha ko'rsatmalar..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Hamshira <span className="text-red-500">*</span>
            </label>
            <select
              value={taskForm.assigneeId}
              onChange={e => setTaskForm(f => ({ ...f, assigneeId: e.target.value }))}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Hamshirani tanlang</option>
              {nurseList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
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
              disabled={savingTask}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingTask && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
