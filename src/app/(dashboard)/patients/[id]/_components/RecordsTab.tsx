'use client';

import { Plus, Printer } from 'lucide-react';
import { Empty } from './ui';
import { printPrescription } from '../_lib/print-templates';

// --- Local prop types ---------------------------------------------------------

interface RecordsTabPrescription {
  id: string;
  medicineName: string;
  dosage: string;
  duration: string;
  instructions?: string;
  createdAt: string;
}

interface RecordsTabRecord {
  id: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  createdAt: string;
  doctor: { name: string; role: string; specialization?: { name: string } | null };
  prescriptions: RecordsTabPrescription[];
}

interface RecordsTabProps {
  records: RecordsTabRecord[];
  isDoctor: boolean;
  onAddClick: () => void;
  fmt: (dateStr: string) => string;
}

export function RecordsTab({ records, isDoctor, onAddClick, fmt }: RecordsTabProps) {
  return (
    <div className="space-y-4">
      {isDoctor && (
        <div className="flex justify-end">
          <button onClick={onAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">
            <Plus className="w-4 h-4" /> Tashxis qo&apos;shish
          </button>
        </div>
      )}
      {records.length === 0 ? <Empty text="Tashxis mavjud emas" /> : records.map(r => (
        <div key={r.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <span className="text-sm font-semibold text-slate-800">{r.doctor?.name}</span>
              <span className="text-xs text-slate-500 ml-2">
                {r.doctor?.specialization?.name ?? r.doctor?.role}
              </span>
            </div>
            <span className="text-xs text-slate-400">{fmt(r.createdAt)}</span>
          </div>
          <div className="p-4 space-y-3">
            {r.diagnosis && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Tashxis</div>
                <p className="text-sm text-slate-800">{r.diagnosis}</p>
              </div>
            )}
            {r.treatment && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Davolash</div>
                <p className="text-sm text-slate-700">{r.treatment}</p>
              </div>
            )}
            {r.notes && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Izoh</div>
                <p className="text-sm text-slate-600">{r.notes}</p>
              </div>
            )}
            {r.prescriptions.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Retsept ({r.prescriptions.length} ta dori)
                </div>
                <div className="space-y-2">
                  {r.prescriptions.map(rx => (
                    <div key={rx.id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-blue-900">{rx.medicineName}</span>
                        <span className="text-xs text-blue-700 ml-2">{rx.dosage} • {rx.duration}</span>
                        {rx.instructions && <p className="text-xs text-blue-600 mt-0.5">{rx.instructions}</p>}
                      </div>
                      <button onClick={() => printPrescription(rx)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md" title="Chop etish">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
