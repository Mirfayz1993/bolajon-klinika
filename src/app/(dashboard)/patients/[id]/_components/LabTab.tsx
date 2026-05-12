'use client';

import { useState } from 'react';
import { Plus, Printer } from 'lucide-react';
import { Empty } from './ui';
import { LAB_STATUS_COLORS } from '../_lib/labels';

// --- Local prop types ---------------------------------------------------------

interface LabTabTest {
  id: string;
  status: string;
  results: Record<string, unknown> | null;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  testType: { name: string; unit?: string | null; normalRange?: string | null; price: number };
  labTech: { name: string; role: string };
  payment?: { id: string; status: string } | null;
}

interface LabTabRouter {
  push: (path: string) => void;
}

interface LabTabProps {
  labTests: LabTabTest[];
  patientId: string;
  canOrderLabTest: boolean;
  onOpenOrderModal: () => void;
  fmt: (dateStr: string) => string;
  router: LabTabRouter;
}

export function LabTab({ labTests, patientId, canOrderLabTest, onOpenOrderModal, fmt, router }: LabTabProps) {
  const [labPrintSelectedIds, setLabPrintSelectedIds] = useState<string[]>([]);

  function toggleLabPrint(id: string) {
    setLabPrintSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function printLabSelected() {
    if (!patientId || labPrintSelectedIds.length === 0) return;
    router.push(`/lab/print?patientId=${patientId}&testIds=${labPrintSelectedIds.join(',')}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {labPrintSelectedIds.length > 0 ? (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-sm text-blue-700 font-medium">{labPrintSelectedIds.length} ta tanlandi</span>
            <button
              onClick={printLabSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Chop et ({labPrintSelectedIds.length} ta)
            </button>
            <button
              onClick={() => setLabPrintSelectedIds([])}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Bekor
            </button>
          </div>
        ) : <div />}
        {canOrderLabTest && (
          <button
            onClick={onOpenOrderModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tahlil buyurtma
          </button>
        )}
      </div>
      {labTests.length === 0 ? <Empty text="Laboratoriya tahlillari yo'q" /> : labTests.map(lt => {
        const canPrint = lt.status === 'COMPLETED' && (!lt.payment || lt.payment.status === 'PAID');
        return (
        <div key={lt.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2 flex-wrap">
              {canPrint && (
                <input
                  type="checkbox"
                  checked={labPrintSelectedIds.includes(lt.id)}
                  onChange={() => toggleLabPrint(lt.id)}
                  className="w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0"
                />
              )}
              <span className="text-sm font-semibold text-slate-800">{lt.testType?.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LAB_STATUS_COLORS[lt.status] ?? ''}`}>
                {lt.status === 'PENDING' ? 'Kutilmoqda'
                  : lt.status === 'IN_PROGRESS' ? 'Jarayonda'
                  : lt.status === 'COMPLETED' ? 'Tayyor'
                  : 'Bekor qilindi'}
              </span>
              {lt.payment && lt.payment.status !== 'PAID' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                  To&apos;lovini kutyapti
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {lt.status === 'COMPLETED' && (
                lt.payment && lt.payment.status !== 'PAID' ? (
                  <span className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-600 rounded-md font-medium">
                    <Printer className="w-3 h-3" />
                    To&apos;lov qilinmagan
                  </span>
                ) : (
                  <button
                    onClick={() => router.push(`/lab/print?patientId=${patientId}&testIds=${lt.id}`)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors font-medium"
                  >
                    <Printer className="w-3 h-3" />
                    Chop
                  </button>
                )
              )}
              <span className="text-xs text-slate-400">{fmt(lt.createdAt)}</span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex justify-between text-xs text-slate-500 mb-3">
              <span>Laborant: {lt.labTech?.name}</span>
              {lt.testType.normalRange && <span>Norma: {lt.testType.normalRange} {lt.testType.unit ?? ''}</span>}
              {lt.completedAt && <span>Tugallandi: {fmt(lt.completedAt)}</span>}
            </div>

            {lt.notes && (() => {
              try {
                const hist = JSON.parse(lt.notes!) as { date: string; from: string | null; to: string; by: string }[];
                if (Array.isArray(hist) && hist.length > 0) return (
                  <div className="bg-amber-50 rounded-lg px-3 py-2 mb-2">
                    <div className="text-xs font-semibold text-amber-700 uppercase mb-1">O&apos;zgarishlar tarixi</div>
                    {hist.map((h, i) => (
                      <div key={i} className="text-xs text-amber-800">
                        {new Date(h.date).toLocaleString('uz-UZ')} — {h.by}:{' '}
                        {h.from != null ? `${h.from} → ${h.to}` : h.to}
                      </div>
                    ))}
                  </div>
                );
              } catch { /* ignore */ }
              return (
                <div className="text-sm text-slate-700 mb-2">
                  <span className="font-medium text-slate-500 text-xs uppercase">Izoh: </span>
                  {lt.notes}
                </div>
              );
            })()}

            {lt.status === 'COMPLETED' && lt.results && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-green-700 uppercase mb-2">Natija</div>
                <div className="space-y-1">
                  {Object.entries(lt.results).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-slate-600">{k}</span>
                      <span className="font-medium text-slate-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lt.status === 'PENDING' && (
              <div className="bg-yellow-50 rounded-lg px-3 py-2 text-sm text-yellow-800">
                Natija hali kiritilmagan — laboratoriya jarayonida
              </div>
            )}
          </div>
        </div>
      );
      })}
    </div>
  );
}
