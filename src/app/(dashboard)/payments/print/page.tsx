'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// --- Types --------------------------------------------------------------------

interface PaymentData {
  id: string;
  amount: number;
  method: string;
  category: string;
  status: string;
  description?: string | null;
  createdAt: string;
  patient: {
    firstName: string;
    lastName: string;
    fatherName: string;
    birthDate?: string | null;
    phone?: string | null;
  };
  receivedBy?: { id: string; name: string } | null;
}

// --- Constants ----------------------------------------------------------------

const GREEN = '#16a34a';
const GREEN_DARK = '#15803d';
const GREEN_BG = '#f0fdf4';

const CLINIC = {
  name: 'BOLAJON KLINIKASI',
  sub: "To'lov cheki",
  address: "G'ijduvon tumani, bolalar poliklinikasi yon tomonida",
  phone: '+998 91 440 02 07',
  logo: '/photo_2026-03-24_20-39-19.jpg',
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Naqd pul',
  CARD: 'Bank kartasi',
  BANK_TRANSFER: "Bank o'tkazmasi",
  CLICK: 'Click',
  PAYME: 'Payme',
};

const CATEGORY_LABELS: Record<string, string> = {
  CHECKUP: 'Shifokor ko\'rigi',
  LAB_TEST: 'Laboratoriya tahlili',
  SPEECH_THERAPY: 'Logoped',
  MASSAGE: 'Massaj',
  TREATMENT: 'Muolaja',
  INPATIENT: 'Statsionar',
  AMBULATORY: 'Ambulator',
};

const STATUS_LABELS: Record<string, string> = {
  PAID: "To'landi",
  PENDING: 'Kutilmoqda',
  PARTIAL: "Qisman to'landi",
  CANCELLED: 'Bekor qilindi',
  REFUNDED: 'Qaytarildi',
};

// --- Helpers ------------------------------------------------------------------

function formatMoney(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm";
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU');
}

// --- Shared cell styles -------------------------------------------------------

function cellStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { border: `1px solid ${GREEN_DARK}`, padding: '6px 10px', fontSize: '12px', ...extra };
}

function thStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { ...cellStyle(extra), background: GREEN, color: '#fff', fontWeight: 'bold', textAlign: 'center' };
}

// --- Print Content ------------------------------------------------------------

function PrintContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('id');

  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!paymentId) { setError("id parametri yo'q"); setLoading(false); return; }
    try {
      const res = await fetch(`/api/payments/${paymentId}`);
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Xatolik');
      }
      setData(await res.json() as PaymentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-red-600">{error ?? "Ma'lumot topilmadi"}</p>
      <Link href="/payments" className="text-green-600 hover:underline text-sm">
        To&apos;lovlarga qaytish
      </Link>
    </div>
  );

  const p = data.patient;
  const shortId = data.id.slice(-6).toUpperCase();
  const isPaid = data.status === 'PAID';

  return (
    <div className="payment-print-only min-h-screen bg-white">

      {/* Toolbar — print da ko'rinmaydi */}
      <div className="print:hidden bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <Link href="/payments" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> To&apos;lovlarga qaytish
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: GREEN }}
        >
          <Printer className="w-4 h-4" /> Chop etish
        </button>
      </div>

      {/* A4 body */}
      <div style={{ fontFamily: 'Arial, sans-serif', padding: '12mm 10mm', maxWidth: '210mm', margin: '0 auto', color: '#000' }}>

        {/* -- HEADER -- */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
          <tbody>
            <tr>
              <td style={{ width: '55%', verticalAlign: 'middle', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={CLINIC.logo} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1px' }}>{CLINIC.name}</div>
                    <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>{CLINIC.sub}</div>
                  </div>
                </div>
              </td>
              <td style={{ width: '45%', textAlign: 'right', verticalAlign: 'middle', fontSize: '11px', lineHeight: '1.7' }}>
                <div><strong>Manzil:</strong> {CLINIC.address}</div>
                <div><strong>Tel:</strong> {CLINIC.phone}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Chiziq */}
        <div style={{ borderTop: `2px solid ${GREEN}`, marginBottom: '8px' }} />

        {/* -- BEMOR MA'LUMOTLARI -- */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
          <tbody>
            {/* F.I.O. */}
            <tr>
              <td style={thStyle({ width: '22%' })}>Ф.И.О.</td>
              <td style={{ ...cellStyle({ fontWeight: 'bold', fontSize: '13px' }), width: '50%' }} colSpan={3}>
                {p.lastName} {p.firstName} {p.fatherName}
              </td>
              {/* Badge */}
              <td rowSpan={3} style={cellStyle({ textAlign: 'center', verticalAlign: 'middle', width: '110px', padding: '6px 4px' })}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: GREEN, marginBottom: '3px' }}>CHEK / ЧЕК</div>
                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>ID: {shortId}</div>
                {isPaid && (
                  <div style={{ marginTop: '4px', background: GREEN, color: '#fff', borderRadius: '4px', padding: '2px 4px', fontSize: '10px', fontWeight: 'bold' }}>
                    ✓ TO&apos;LANDI
                  </div>
                )}
              </td>
            </tr>
            {/* Tug'ilgan sana */}
            <tr>
              <td style={thStyle()}>Tug&apos;ilgan sana</td>
              <td style={cellStyle({ width: '28%' })}>{p.birthDate ? formatDate(p.birthDate) : '—'}</td>
              <td style={thStyle({ width: '10%' })}>Tel</td>
              <td style={cellStyle({ width: '18%' })}>{p.phone ?? '—'}</td>
            </tr>
            {/* Sana */}
            <tr>
              <td style={thStyle()}>To&apos;lov sanasi</td>
              <td style={cellStyle()} colSpan={3}>{formatDateTime(data.createdAt)}</td>
            </tr>
          </tbody>
        </table>

        {/* -- XIZMAT JADVALI -- */}
        <div style={{ textAlign: 'center', margin: '8px 0 6px' }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: '#14532d',
            borderBottom: `2px solid ${GREEN}`,
            paddingBottom: '2px',
          }}>
            Xizmat tafsiloti
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
          <thead>
            <tr>
              <th style={thStyle({ textAlign: 'left', width: '50%' })}>Xizmat turi</th>
              <th style={thStyle({ width: '20%' })}>To&apos;lov usuli</th>
              <th style={thStyle({ width: '15%' })}>Holat</th>
              <th style={thStyle({ textAlign: 'right', width: '15%' })}>Summa</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: GREEN_BG }}>
              <td style={cellStyle()}>
                <div style={{ fontWeight: 'bold' }}>{CATEGORY_LABELS[data.category] ?? data.category}</div>
                {data.description && (
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{data.description}</div>
                )}
              </td>
              <td style={cellStyle({ textAlign: 'center' })}>{METHOD_LABELS[data.method] ?? data.method}</td>
              <td style={cellStyle({ textAlign: 'center', fontWeight: 'bold', color: isPaid ? GREEN : '#b45309' })}>
                {STATUS_LABELS[data.status] ?? data.status}
              </td>
              <td style={cellStyle({ textAlign: 'right', fontWeight: 'bold', fontSize: '13px' })}>
                {formatMoney(data.amount)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={thStyle({ textAlign: 'right', borderTop: `2px solid ${GREEN_DARK}` })}>
                JAMI:
              </td>
              <td style={{ ...cellStyle({ textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderTop: `2px solid ${GREEN_DARK}` }), background: GREEN_BG }}>
                {formatMoney(data.amount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* -- FOOTER -- */}
        <div style={{
          marginTop: '24px',
          borderTop: `1px solid ${GREEN}`,
          paddingTop: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
        }}>
          <span>
            Qabul qildi:{' '}
            <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '100px' }}>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            </span>
            {' '}{data.receivedBy?.name ?? ''}
          </span>
          <span style={{ color: '#666', fontSize: '11px' }}>
            Chop etilgan: {formatDateTime(new Date().toISOString())}
          </span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body * { visibility: hidden; }
          .payment-print-only, .payment-print-only * { visibility: visible; }
          .payment-print-only {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
            background: white;
            z-index: 9999;
          }
        }
      `}</style>
    </div>
  );
}

export default function PaymentPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
