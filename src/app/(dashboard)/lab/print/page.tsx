'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// --- Types --------------------------------------------------------------------

interface PrintGroup {
  category: string;
  tests: Array<{
    id: string;
    name: string;
    result: unknown;
    normalRange: string | null;
    unit: string | null;
    completedAt: string | null;
  }>;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  birthDate: string | null;
  gender: string | null;
}

interface PrintData {
  patient: Patient | null;
  groups: PrintGroup[];
  printedAt: string;
  labTech: { id: string; name: string } | null;
}

// --- Helpers ------------------------------------------------------------------

function formatResult(result: unknown): string {
  if (result === null || result === undefined) return '—';
  if (typeof result === 'string') return result;
  if (typeof result === 'number') return String(result);
  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>;
    if ('value' in r) return String(r.value);
    if ('result' in r) return String(r.result);
    return JSON.stringify(result);
  }
  return String(result);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function genderLabel(g: string | null): string {
  if (g === 'MALE') return 'Erkak';
  if (g === 'FEMALE') return 'Qiz';
  return '—';
}

// --- Constants ----------------------------------------------------------------

const GREEN = '#16a34a';
const GREEN_DARK = '#15803d';
const GREEN_BG = '#f0fdf4';

const CLINIC = {
  name: 'BOLAJON KLINIKASI',
  sub: 'Laboratoriya tahlil natijalari',
  address: "G'ijduvon tumani, bolalar poliklinikasi yon tomonida",
  phone: '+998 91 440 02 07',
  logo: '/photo_2026-03-24_20-39-19.jpg',
};

// --- Shared cell styles -------------------------------------------------------

function cellStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { border: `1px solid ${GREEN_DARK}`, padding: '5px 10px', fontSize: '12px', ...extra };
}

function thStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { ...cellStyle(extra), background: GREEN, color: '#fff', fontWeight: 'bold', textAlign: 'center' };
}

// --- Print Content ------------------------------------------------------------

function PrintContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const testIds = searchParams.get('testIds');
  const date = searchParams.get('date');

  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!patientId) { setError('patientId majburiy'); setLoading(false); return; }
    try {
      const params = new URLSearchParams({ patientId });
      if (testIds) params.set('testIds', testIds);
      if (date) params.set('date', date);
      const res = await fetch(`/api/lab/print?${params}`);
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Xatolik');
      }
      setData(await res.json() as PrintData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }, [patientId, testIds, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-red-600">{error ?? "Ma'lumot topilmadi"}</p>
      <Link href="/lab" className="text-green-600 hover:underline text-sm">Laboratoriyaga qaytish</Link>
    </div>
  );

  if (data.groups.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-slate-500">Tugallangan tahlillar topilmadi</p>
      <Link href="/lab" className="text-green-600 hover:underline text-sm">Laboratoriyaga qaytish</Link>
    </div>
  );

  const p = data.patient;
  const printDate = date ? formatDate(date) : formatDate(data.printedAt);
  const firstTestId = data.groups[0]?.tests[0]?.id ?? '';
  const shortId = firstTestId.slice(-6).toUpperCase();

  return (
    <div className="lab-print-only min-h-screen bg-white">

      {/* Toolbar — print da ko'rinmaydi */}
      <div className="print:hidden bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <Link href="/lab" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Laboratoriyaga qaytish
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

        {/* -- BEMOR JADVALI -- */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
          <tbody>
            {/* F.I.O. */}
            <tr>
              <td style={thStyle({ width: '20%' })}>Ф.И.О.</td>
              <td style={{ ...cellStyle({ fontWeight: 'bold', fontSize: '13px' }), width: '55%' }} colSpan={3}>
                {p ? `${p.lastName} ${p.firstName} ${p.fatherName}` : '—'}
              </td>
              {/* Badge */}
              <td rowSpan={3} style={cellStyle({ textAlign: 'center', verticalAlign: 'middle', width: '110px', padding: '6px 4px' })}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: GREEN, marginBottom: '3px' }}>TAHLIL NATIJALARI</div>
                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>ID: {shortId}</div>
              </td>
            </tr>
            {/* Tug'ilgan sana + Jins */}
            <tr>
              <td style={thStyle()}>Tug&apos;ilgan yil</td>
              <td style={cellStyle({ width: '20%' })}>{p?.birthDate ? new Date(p.birthDate).getFullYear() : '—'}</td>
              <td style={thStyle({ width: '10%' })}>Jins</td>
              <td style={cellStyle({ width: '20%' })}>{p ? genderLabel(p.gender) : '—'}</td>
            </tr>
            {/* Natija sanasi */}
            <tr>
              <td style={thStyle()}>Natija sanasi</td>
              <td style={cellStyle()} colSpan={3}>{printDate}</td>
            </tr>
          </tbody>
        </table>

        {/* -- GURUHLAR -- */}
        {data.groups.map((group) => (
          <div key={group.category} style={{ marginBottom: '16px' }}>
            {/* Kategoriya sarlavhasi */}
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
                {group.category}
              </span>
            </div>

            {/* Natijalar jadvali */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle({ textAlign: 'left', width: '45%' })}>Наименование Анализа</th>
                  <th style={thStyle({ width: '18%' })}>Результат</th>
                  <th style={thStyle({ width: '25%' })}>Норма</th>
                  <th style={thStyle({ width: '12%' })}>Ед.изм</th>
                </tr>
              </thead>
              <tbody>
                {group.tests.map((test, i) => (
                  <tr key={test.id} style={{ background: i % 2 === 0 ? '#fff' : GREEN_BG }}>
                    <td style={cellStyle()}>{test.name}</td>
                    <td style={cellStyle({ textAlign: 'center', fontWeight: 'bold', fontSize: '13px' })}>
                      {formatResult(test.result)}
                    </td>
                    <td style={cellStyle({ textAlign: 'center', color: '#555' })}>{test.normalRange ?? '—'}</td>
                    <td style={cellStyle({ textAlign: 'center', color: '#555' })}>{test.unit ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

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
            Tahlil o&apos;tkazdi:{' '}
            <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '100px' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            {' '}{data.labTech?.name ?? ''}
          </span>
          <span style={{ color: '#666', fontSize: '11px' }}>
            Chop etilgan: {new Date(data.printedAt).toLocaleString('ru-RU')}
          </span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          /* Fon ranglarni saqlab qolish */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Sidebar, header va boshqa layout elementlarini yashirish */
          body * { visibility: hidden; }
          .lab-print-only, .lab-print-only * { visibility: visible; }
          .lab-print-only {
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

export default function LabPrintPage() {
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
