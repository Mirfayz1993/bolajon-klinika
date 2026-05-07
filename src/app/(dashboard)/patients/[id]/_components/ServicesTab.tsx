'use client';

import { Loader2, Plus, Printer, Check, Trash2 } from 'lucide-react';
import { Section } from './ui';

// --- Local prop types ---------------------------------------------------------

interface AssignedService {
  id: string;
  categoryName: string;
  itemName: string;
  price: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentId: string | null;
  assignedAt: string;
  assignedBy: { name: string; role: string };
  doctor?: { name: string; role: string } | null;
  admission?: { bed: { bedNumber: string; room: { roomNumber: string; floor: number } } | null } | null;
}

interface Appointment {
  id: string;
  type: string;
  status: string;
  dateTime: string;
  notes?: string | null;
  doctor: { name: string; role: string; specialization?: { name: string } | null };
}

interface NurseNoteMedicine {
  name: string;
  quantity: number;
  unit: string;
}

interface NurseNoteLite {
  id: string;
  medicines?: NurseNoteMedicine[] | null;
  createdAt: string;
}

interface ServicesTabProps {
  assignedServices: AssignedService[];
  assignedLoading: boolean;
  appointments: Appointment[];
  nurseNotes: NurseNoteLite[];
  selectedForPay: Set<string>;
  toggleSelectForPay: (id: string) => void;
  selectAllUnpaid: () => void;
  canSeePrices: boolean;
  canManageServices: boolean;
  onAssignClick: () => void;
  onPayClick: (svc: AssignedService) => void;
  onDelete: (id: string) => void;
  onPrintReceipt: (justPaidIds?: string[]) => void;
  onBulkPay: () => void;
  fmtMoney: (amount: number) => string;
  fmtDate: (dateStr: string) => string;
  fmt: (dateStr: string) => string;
  apptTypeLabels: Record<string, string>;
  apptStatusColors: Record<string, string>;
}

export function ServicesTab({
  assignedServices,
  assignedLoading,
  appointments,
  nurseNotes,
  selectedForPay,
  toggleSelectForPay,
  selectAllUnpaid,
  canSeePrices,
  canManageServices,
  onAssignClick,
  onPayClick,
  onDelete,
  onPrintReceipt,
  onBulkPay,
  fmtMoney,
  fmtDate,
  fmt,
  apptTypeLabels,
  apptStatusColors,
}: ServicesTabProps) {
  return (
    <div className="flex gap-4">
      {/* Left: main list */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Tayinlangan xizmatlar */}
        <Section
          title="Tayinlangan xizmatlar"
          count={assignedServices.length}
          action={canManageServices ? (
            <button
              type="button"
              onClick={onAssignClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Xizmat tayinlash
            </button>
          ) : undefined}
        >
          {assignedLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>
          ) : assignedServices.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Hali xizmat tayinlanmagan</p>
          ) : (
            <>
              {assignedServices.map(svc => (
                <div key={svc.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {svc.categoryName}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{svc.itemName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${svc.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {svc.isPaid ? 'To\'langan' : 'Kutilmoqda'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {svc.assignedBy?.name} • {fmtDate(svc.assignedAt)}
                      {svc.paidAt && ` • To'langan: ${fmtDate(svc.paidAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {canSeePrices ? (
                      <span className="text-sm font-semibold text-slate-800">{fmtMoney(Number(svc.price))}</span>
                    ) : (
                      <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {svc.isPaid ? "To'langan" : "Kutilmoqda"}
                      </span>
                    )}
                    {svc.isPaid && canSeePrices && (
                      <button
                        type="button"
                        onClick={() => onPrintReceipt([svc.id])}
                        className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors"
                        title="Chek chiqarish"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!svc.isPaid && canManageServices && (
                      <button
                        type="button"
                        onClick={() => onPayClick(svc)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        To&apos;lash
                      </button>
                    )}
                    {!svc.isPaid && canManageServices && (
                      <button
                        type="button"
                        onClick={() => onDelete(svc.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {/* Jami */}
              {canSeePrices && assignedServices.some(s => s.isPaid) && (
                <div className="flex justify-between text-sm font-semibold pt-3 border-t border-slate-200">
                  <span className="text-slate-600">Jami to&apos;langan:</span>
                  <span className="text-green-700">
                    {fmtMoney(assignedServices.filter(s => s.isPaid).reduce((sum, s) => sum + Number(s.price), 0))}
                  </span>
                </div>
              )}
            </>
          )}
        </Section>

        {/* Navbatlar (Uchrashuvlar) */}
        {appointments.length > 0 && (
          <Section title="Navbatlar" count={appointments.length}>
            {appointments.map(a => (
              <div key={a.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {apptTypeLabels[a.type] ?? a.type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${apptStatusColors[a.status] ?? ''}`}>
                      {a.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {a.doctor?.name} • {fmt(a.dateTime)}
                  </p>
                  {a.notes && <p className="text-xs text-slate-400 mt-0.5">{a.notes}</p>}
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>{/* end left */}

      {/* -- Right panel: To'lov tayyorlash (faqat ADMIN/RECEPTIONIST) -- */}
      {canSeePrices && (
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        {/* Chek chiqarish */}
        <button
          type="button"
          onClick={() => onPrintReceipt()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-900 transition-colors w-full"
        >
          <Printer className="w-4 h-4" /> Chek chiqarish
        </button>

        {/* Unpaid services to select */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-800">To&apos;lov tayyorlash</span>
            {assignedServices.some(s => !s.isPaid) && (
              <button type="button" onClick={selectAllUnpaid} className="text-xs text-amber-600 hover:text-amber-800 underline">
                Barchasini
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {assignedServices.filter(s => !s.isPaid).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Barcha xizmatlar to&apos;langan</p>
            ) : (
              assignedServices.filter(s => !s.isPaid).map(svc => (
                <label key={svc.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedForPay.has(svc.id)}
                    onChange={() => toggleSelectForPay(svc.id)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{svc.itemName}</p>
                    <p className="text-xs text-slate-400">{svc.categoryName}</p>
                    <p className="text-xs font-semibold text-blue-700 mt-0.5">{fmtMoney(Number(svc.price))}</p>
                  </div>
                </label>
              ))
            )}
          </div>

          {/* Medicines from nurse notes */}
          {nurseNotes?.some(n => Array.isArray(n.medicines) && (n.medicines as unknown[]).length > 0) && (
            <>
              <div className="px-4 py-2 bg-purple-50 border-t border-purple-100">
                <span className="text-xs font-semibold text-purple-700">💊 Dorilar (eslatma)</span>
              </div>
              {nurseNotes.map(n =>
                Array.isArray(n.medicines) && (n.medicines as unknown[]).length > 0
                  ? (n.medicines as NurseNoteMedicine[]).map((m, i) => (
                      <div key={`${n.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.quantity} {m.unit} · {fmtDate(n.createdAt)}</p>
                        </div>
                      </div>
                    ))
                  : null
              )}
            </>
          )}
        </div>

        {/* Bulk pay button */}
        {selectedForPay.size > 0 && (
          <button
            type="button"
            onClick={onBulkPay}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors w-full"
          >
            <Check className="w-4 h-4" />
            {selectedForPay.size} ta — {fmtMoney(
              assignedServices.filter(s => selectedForPay.has(s.id)).reduce((sum, s) => sum + Number(s.price), 0)
            )} to&apos;lash
          </button>
        )}
      </div>
      )}
    </div>
  );
}
