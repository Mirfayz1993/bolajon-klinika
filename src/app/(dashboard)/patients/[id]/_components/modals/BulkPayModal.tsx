'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

interface BulkPayModalProps {
  open: boolean;
  count: number;
  total: number;
  /** Optional list of services to render inside the modal (asl page'da bor edi). */
  services?: { id: string; itemName: string; price: number | string }[];
  onClose: () => void;
  onConfirm: (method: string) => void;
  paying: boolean;
  fmtMoney: (amount: number) => string;
  canSeePrices: boolean;
  onMethodChange?: (method: string) => void;
}

const PAY_METHODS = [
  { val: 'CASH', label: 'Naqd pul' },
  { val: 'CARD', label: 'Karta' },
  { val: 'CLICK', label: 'Click' },
  { val: 'PAYME', label: 'Payme' },
  { val: 'BANK_TRANSFER', label: "Bank o'tkazma" },
];

export function BulkPayModal({
  open,
  count,
  total,
  services,
  onClose,
  onConfirm,
  paying,
  fmtMoney,
  canSeePrices,
  onMethodChange,
}: BulkPayModalProps) {
  const [bulkPayMethod, setBulkPayMethod] = useState('CASH');

  useEffect(() => {
    if (open) setBulkPayMethod('CASH');
  }, [open]);

  if (!open) return null;

  const handleSelectMethod = (val: string) => {
    setBulkPayMethod(val);
    onMethodChange?.(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">To&apos;lov qilish ({count} ta)</h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="mb-4 max-h-40 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl">
          {services?.map(svc => (
            <div key={svc.id} className="flex justify-between px-3 py-2 text-sm">
              <span className="text-slate-700 truncate">{svc.itemName}</span>
              {canSeePrices && (
                <span className="font-semibold text-blue-700 ml-2 flex-shrink-0">
                  {fmtMoney(Number(svc.price))}
                </span>
              )}
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 text-sm font-bold bg-blue-50">
            <span>Jami</span>
            {canSeePrices && <span className="text-blue-700">{fmtMoney(total)}</span>}
          </div>
        </div>
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
            To&apos;lov usuli
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PAY_METHODS.map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() => handleSelectMethod(opt.val)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  bulkPayMethod === opt.val
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Bekor
          </button>
          <button
            type="button"
            onClick={() => onConfirm(bulkPayMethod)}
            disabled={paying}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
          >
            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            To&apos;lash
          </button>
        </div>
      </div>
    </div>
  );
}
