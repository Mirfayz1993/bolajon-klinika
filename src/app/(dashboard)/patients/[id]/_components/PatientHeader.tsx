'use client';

import {
  ArrowLeft, Pencil, Trash2, User, Phone, MapPin, Hash, QrCode,
} from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

// --- Local types --------------------------------------------------------------

interface HeaderPatient {
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  jshshir: string;
  birthDate: string;
  district: string | null;
  createdAt: string;
}

interface PatientHeaderPt {
  fields?: {
    age?: string;
    registered?: string;
    totalPayment?: string;
    operations?: string;
  };
}

interface PatientHeaderProps {
  patient: HeaderPatient;
  totalPaid: number;
  paymentsCount: number;
  pt: PatientHeaderPt;
  fromQueue: boolean;
  fromAmbulatory: boolean;
  isAdmin: boolean;
  canSeePrices: boolean;
  calcAge: (birthDate: string) => number;
  fmtDate: (dateStr: string) => string;
  fmtMoney: (amount: number) => string;
  onBack: () => void;
  onBackToQueue: () => void;
  onBackToAmbulatory: () => void;
  onQrClick: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
}

export function PatientHeader({
  patient,
  totalPaid,
  paymentsCount,
  pt,
  fromQueue,
  fromAmbulatory,
  isAdmin,
  canSeePrices,
  calcAge,
  fmtDate,
  fmtMoney,
  onBack,
  onBackToQueue,
  onBackToAmbulatory,
  onQrClick,
  onEditClick,
  onDeleteClick,
}: PatientHeaderProps) {
  const { t } = useLanguage();

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm">
          <ArrowLeft className="w-4 h-4" /> {t.common.back}
        </button>
        <div className="flex items-center gap-2">
          {fromQueue && (
            <button
              onClick={onBackToQueue}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <ArrowLeft className="w-4 h-4" /> Navbatga qaytish
            </button>
          )}
          {fromAmbulatory && (
            <button
              onClick={onBackToAmbulatory}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <ArrowLeft className="w-4 h-4" /> Ambulatoryaga qaytish
            </button>
          )}
          <button onClick={onQrClick}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
            <QrCode className="w-4 h-4" /> QR
          </button>
          <button onClick={onEditClick}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
            <Pencil className="w-4 h-4" /> {t.common.edit}
          </button>
          {isAdmin && (
            <button onClick={onDeleteClick}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 text-red-600">
              <Trash2 className="w-4 h-4" /> {t.common.delete}
            </button>
          )}
        </div>
      </div>

      {/* Patient card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">
              {patient.lastName} {patient.firstName} {patient.fatherName}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {calcAge(patient.birthDate)} {pt.fields?.age ?? 'yosh'} • {pt.fields?.registered ?? "Ro'yxatdan o'tgan"}: {fmtDate(patient.createdAt)}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{patient.phone}</span>
              {patient.jshshir && <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />{patient.jshshir}</span>}
              {patient.district && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{patient.district}</span>}
            </div>
          </div>
          {canSeePrices && (
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-slate-500">{pt.fields?.totalPayment ?? "Jami to'lov"}</div>
              <div className="text-lg font-bold text-green-700">{fmtMoney(totalPaid)}</div>
              <div className="text-xs text-slate-400 mt-0.5">{paymentsCount} {pt.fields?.operations ?? 'ta operatsiya'}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
