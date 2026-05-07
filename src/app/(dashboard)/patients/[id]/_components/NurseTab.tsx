'use client';

import { Plus } from 'lucide-react';
import { Empty } from './ui';
import { floorLabel } from '@/lib/utils';

// --- Local prop types ---------------------------------------------------------

interface NurseTabNote {
  id: string;
  procedure: string;
  notes?: string | null;
  medicines?: { name: string; quantity: number; unit: string }[] | null;
  noteType?: string | null;
  createdAt: string;
  nurse: { name: string; role: string };
  admission?: {
    bed: { bedNumber: string; room: { floor: number; roomNumber: string } };
  } | null;
}

interface NurseTabProps {
  nurseNotes: NurseTabNote[];
  isNurse: boolean;
  urlNoteType: string;
  onAddClick: () => void;
  fmt: (dateStr: string) => string;
}

export function NurseTab({ nurseNotes, isNurse, urlNoteType, onAddClick, fmt }: NurseTabProps) {
  return (
    <div className="space-y-4">
      {isNurse && (
        <div className="flex items-center justify-between">
          {urlNoteType === 'AMBULATORY' && (
            <span className="text-xs font-medium bg-teal-100 text-teal-800 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
              Ambulator bo&apos;limdan kirildi
            </span>
          )}
          <button
            onClick={onAddClick}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg">
            <Plus className="w-4 h-4" /> Qayd qo&apos;shish
          </button>
        </div>
      )}

      {nurseNotes.length === 0 ? <Empty text="Hamshira qaydlari yo'q" /> : nurseNotes.map(n => (
        <div key={n.id} className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{n.procedure}</span>
              {n.noteType === 'AMBULATORY' && (
                <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Ambulator</span>
              )}
              {n.admission && (
                <span className="text-xs text-slate-500">
                  ({floorLabel(n.admission.bed.room.floor)}, {n.admission.bed.room.roomNumber}-xona)
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">{fmt(n.createdAt)}</span>
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Hamshira: <span className="font-medium">{n.nurse?.name}</span>
          </p>
          {n.notes && <p className="text-sm text-slate-700 mb-2">{n.notes}</p>}
          {n.medicines && n.medicines.length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Ishlatilgan dorilar</div>
              <div className="flex flex-wrap gap-2">
                {n.medicines.map((m, i) => (
                  <span key={i} className="bg-orange-50 text-orange-800 text-xs px-2 py-1 rounded-md">
                    {m.name} — {m.quantity} {m.unit}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
