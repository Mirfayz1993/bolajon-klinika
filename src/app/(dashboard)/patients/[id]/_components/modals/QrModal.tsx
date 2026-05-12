'use client';

import { Loader2, Printer } from 'lucide-react';
import { Modal } from '../ui';

// --- Local types --------------------------------------------------------------

interface QrModalPatient {
  firstName: string;
  lastName: string;
  phone: string;
}

interface QrModalProps {
  open: boolean;
  patient: QrModalPatient;
  qrDataUrl: string | null;
  qrLoading: boolean;
  canPrintQr: boolean;
  onClose: () => void;
  onPrint: () => void;
}

export function QrModal({
  open,
  patient,
  qrDataUrl,
  qrLoading,
  canPrintQr,
  onClose,
  onPrint,
}: QrModalProps) {
  if (!open) return null;

  return (
    <Modal title="Bemor QR Kodi" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 py-4">
        {qrLoading ? (
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        ) : qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR" className="w-52 h-52 rounded-xl" />
        ) : (
          <div className="text-slate-500 text-sm">QR yuklanmadi</div>
        )}
        <p className="text-sm text-slate-600 text-center">
          {patient.lastName} {patient.firstName}
          <br />
          <span className="text-slate-400 text-xs">{patient.phone}</span>
        </p>
        {canPrintQr && (
          <button
            onClick={onPrint}
            disabled={!qrDataUrl}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Chop etish
          </button>
        )}
      </div>
    </Modal>
  );
}
