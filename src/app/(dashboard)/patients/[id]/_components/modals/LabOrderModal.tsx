'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';

// --- Local types --------------------------------------------------------------

interface LabOrderType {
  id: string;
  name: string;
  price: number;
  category: string | null;
  parentId?: string | null;
}

interface LabOrderModalPatient {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
}

interface LabOrderModalProps {
  open: boolean;
  patient: LabOrderModalPatient | null;
  canSeePrices: boolean;
  onClose: () => void;
}

export function LabOrderModal({ open, patient, canSeePrices, onClose }: LabOrderModalProps) {
  const [patientLabAllTypes, setPatientLabAllTypes] = useState<LabOrderType[]>([]);
  const [patientLabSelectedIds, setPatientLabSelectedIds] = useState<string[]>([]);
  const [patientLabOpenGroups, setPatientLabOpenGroups] = useState<Set<string>>(new Set());
  const [patientLabOrderSaving, setPatientLabOrderSaving] = useState(false);
  const [patientLabOrderError, setPatientLabOrderError] = useState<string | null>(null);
  const [patientLabOrderDone, setPatientLabOrderDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset state on each open
    setPatientLabSelectedIds([]);
    setPatientLabOpenGroups(new Set());
    setPatientLabOrderError(null);
    setPatientLabOrderDone(false);
    fetch('/api/lab-test-types')
      .then(r => r.json())
      .then(d => setPatientLabAllTypes(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {});
  }, [open]);

  const handleClose = () => {
    onClose();
    if (patientLabOrderDone) window.location.reload();
  };

  async function handlePatientLabOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || patientLabSelectedIds.length === 0) return;
    setPatientLabOrderSaving(true);
    setPatientLabOrderError(null);
    try {
      const results = await Promise.all(
        patientLabSelectedIds.map(async id => {
          const tt = patientLabAllTypes.find(x => x.id === id);
          if (!tt) return null;
          const res = await fetch(`/api/patients/${patient.id}/assigned-services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryName: 'Laboratoriya',
              itemName: tt.name,
              price: Number(tt.price),
              itemId: tt.id,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { error: err.error || `${tt.name}: xatolik`, name: tt.name };
          }
          return null;
        })
      );
      const errors = results.filter(Boolean) as { error: string; name: string }[];
      if (errors.length > 0) {
        setPatientLabOrderError(errors.map(e => e.error).join('; '));
        setPatientLabOrderSaving(false);
        return;
      }
      setPatientLabOrderDone(true);
    } catch {
      setPatientLabOrderError('Xatolik yuz berdi');
    } finally {
      setPatientLabOrderSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{patientLabOrderDone ? 'Buyurtma saqlandi' : 'Tahlil buyurtma'}</h2>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {patientLabOrderDone ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              <p className="text-sm text-slate-500 mb-4">Quyidagi tahlillar tayinlangan xizmatlarga qo&apos;shildi. Qabulxona to&apos;lovni qabul qilgach laboratoriyaga yuboriladi.</p>
              {patientLabSelectedIds.map(id => {
                const tt = patientLabAllTypes.find(x => x.id === id);
                if (!tt) return null;
                return (
                  <div key={id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm text-slate-800">{tt.name}</span>
                    <div className="flex items-center gap-3">
                      {canSeePrices && <span className="text-sm text-slate-500">{Number(tt.price).toLocaleString()} so&apos;m</span>}
                      <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">To&apos;lanmagan</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button type="button" onClick={() => { onClose(); window.location.reload(); }} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Yopish</button>
            </div>
          </div>
        ) : (
        <form onSubmit={handlePatientLabOrderSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0 bg-blue-50">
            <p className="text-sm font-medium text-slate-700">
              Bemor: <span className="font-bold text-slate-900">{patient?.lastName} {patient?.firstName} {patient?.fatherName}</span>
            </p>
          </div>
          {patientLabOrderError && (
            <div className="px-6 pt-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {patientLabOrderError}
              </div>
            </div>
          )}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Tahlil turini tanlang <span className="text-red-500">*</span>
              {patientLabSelectedIds.length > 0 && (
                <span className="ml-2 normal-case font-normal text-blue-600">({patientLabSelectedIds.length} ta tanlandi)</span>
              )}
            </div>
            {patientLabAllTypes.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : (() => {
              const groups: Record<string, LabOrderType[]> = {};
              for (const tt of patientLabAllTypes) {
                const cat = tt.category ?? 'Boshqalar';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(tt);
              }
              return Object.entries(groups).map(([cat, items]) => {
                const isOpen = patientLabOpenGroups.has(cat);
                const groupSelected = items.filter(it => patientLabSelectedIds.includes(it.id));
                return (
                  <div key={cat} className="mb-2 border border-slate-200 rounded-xl overflow-hidden">
                    <button type="button" onClick={() => setPatientLabOpenGroups(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">{cat}</span>
                        {groupSelected.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{groupSelected.length} ta</span>}
                      </div>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-slate-50">
                        {items.map(tt => {
                          const checked = patientLabSelectedIds.includes(tt.id);
                          return (
                            <label key={tt.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${checked ? 'bg-blue-50/50' : ''}`}>
                              <input type="checkbox" checked={checked} onChange={() => setPatientLabSelectedIds(prev => prev.includes(tt.id) ? prev.filter(x => x !== tt.id) : [...prev, tt.id])} className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                              <span className="flex-1 text-sm text-slate-800">{tt.name}</span>
                              {canSeePrices && <span className="text-sm text-slate-500 font-medium">{tt.price.toLocaleString()} so&apos;m</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
            {canSeePrices && patientLabSelectedIds.length > 0 && (() => {
              const groups: Record<string, { name: string; total: number }> = {};
              for (const id of patientLabSelectedIds) {
                const tt = patientLabAllTypes.find(x => x.id === id);
                if (!tt) continue;
                const cat = tt.category ?? 'Boshqalar';
                if (!groups[cat]) groups[cat] = { name: cat, total: 0 };
                groups[cat].total += Number(tt.price);
              }
              const grandTotal = Object.values(groups).reduce((s, g) => s + g.total, 0);
              const groupEntries = Object.values(groups);
              return (
                <div className="mb-4 bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                  {groupEntries.map(g => (
                    <div key={g.name} className="flex justify-between text-sm text-slate-600">
                      <span>{g.name}</span>
                      <span className="font-medium">{g.total.toLocaleString()} so&apos;m</span>
                    </div>
                  ))}
                  {groupEntries.length > 1 && (
                    <div className="flex justify-between text-sm font-bold text-slate-800 pt-1.5 border-t border-slate-200">
                      <span>Jami</span>
                      <span>{grandTotal.toLocaleString()} so&apos;m</span>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">Bekor</button>
              <button type="submit" disabled={patientLabOrderSaving || patientLabSelectedIds.length === 0} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                {patientLabOrderSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Buyurtma berish ({patientLabSelectedIds.length})
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
