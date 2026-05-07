'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

interface AssignedServiceLite {
  id: string;
  itemName: string;
  categoryName: string;
  price: number | string;
}

interface PayModalProps {
  open: boolean;
  service: AssignedServiceLite | null;
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

export function PayModal({
  open,
  service,
  onClose,
  onConfirm,
  paying,
  fmtMoney,
  canSeePrices,
  onMethodChange,
}: PayModalProps) {
  const [payMethod, setPayMethod] = useState('CASH');

  // Modal har ochilganda CASH'ga qaytadi (asl page'dagi openPayModal pattern'i)
  useEffect(() => {
    if (open) setPayMethod('CASH');
  }, [open]);

  if (!open || !service) return null;

  const handleSelectMethod = (val: string) => {
    setPayMethod(val);
    onMethodChange?.(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">To&apos;lov qilish</h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm">
          <p className="text-slate-500 text-xs mb-1">{service.categoryName}</p>
          <p className="font-medium text-slate-800">{service.itemName}</p>
          {canSeePrices && (
            <p className="text-blue-700 font-bold mt-1">{fmtMoney(Number(service.price))}</p>
          )}
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
                  payMethod === opt.val
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
            onClick={() => onConfirm(payMethod)}
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
