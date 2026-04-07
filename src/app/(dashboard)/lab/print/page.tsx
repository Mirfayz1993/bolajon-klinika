'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  birthDate: string | null;
  gender: string | null;
}

interface PrintData {
  patient: Patient | null;
  groups: PrintGroup[];
  printedAt: string;
  labTech: { id: string; name: string } | null;
}

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

// ─── Print Content ────────────────────────────────────────────────────────────

function PrintContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const testIds = searchParams.get('testIds');
  const date = searchParams.get('date');

  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!patientId) {
      setError('patientId majburiy');
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ patientId });
      if (testIds) params.set('testIds', testIds);
      if (date) params.set('date', date);
      const res = await fetch(`/api/lab/print?${params}`);
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Xatolik');
      }
      const json: PrintData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }, [patientId, testIds, date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-600">{error ?? 'Ma\'lumot topilmadi'}</p>
        <Link href="/lab" className="text-blue-600 hover:underline text-sm">
          Laboratoriyaga qaytish
        </Link>
      </div>
    );
  }

  if (data.groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-slate-500">Tugallangan tahlillar topilmadi</p>
        <Link href="/lab" className="text-blue-600 hover:underline text-sm">
          Laboratoriyaga qaytish
        </Link>
      </div>
    );
  }

  const patient = data.patient;
  const printDate = date ?? new Date(data.printedAt).toLocaleDateString('ru-RU');

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar — print da ko'rinmaydi */}
      <div className="print:hidden bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <Link
          href="/lab"
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Laboratoriyaga qaytish
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Printer className="w-4 h-4" />
          Chop etish
        </button>
      </div>

      {/* Print body */}
      <div
        id="print-body"
        style={{ fontFamily: 'Arial, sans-serif', padding: '20mm 15mm', maxWidth: '210mm', margin: '0 auto' }}
      >
        {/* Clinic header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px', margin: 0 }}>
            BOLAJON KLINIKASI
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>
            Laboratoriya tahlil natijalari
          </p>
        </div>

        {/* Patient info */}
        {patient && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '10px',
            marginBottom: '16px',
            fontSize: '13px',
          }}>
            <div>
              <strong>Bemor:</strong>{' '}
              {patient.lastName} {patient.firstName}
              {patient.birthDate && (
                <span style={{ marginLeft: '12px', color: '#64748b' }}>
                  t.y.: {new Date(patient.birthDate).toLocaleDateString('ru-RU')}
                </span>
              )}
            </div>
            <div>
              <strong>Sana:</strong> {printDate}
            </div>
          </div>
        )}

        {/* Groups */}
        {data.groups.map((group) => (
          <div key={group.category} style={{ marginBottom: '20px' }}>
            {/* Category header */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <h2 style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#1e40af',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                margin: 0,
              }}>
                {group.category}
              </h2>
            </div>

            {/* Table */}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#dbeafe' }}>
                  <th style={{ border: '1px solid #94a3b8', padding: '6px 10px', textAlign: 'left', fontWeight: 'bold' }}>
                    Наименование Анализа
                  </th>
                  <th style={{ border: '1px solid #94a3b8', padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', width: '120px' }}>
                    Результат
                  </th>
                  <th style={{ border: '1px solid #94a3b8', padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', width: '150px' }}>
                    Норма
                  </th>
                  <th style={{ border: '1px solid #94a3b8', padding: '6px 10px', textAlign: 'center', fontWeight: 'bold', width: '80px' }}>
                    Ед.изм
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.tests.map((test) => (
                  <tr key={test.id}>
                    <td style={{ border: '1px solid #94a3b8', padding: '6px 10px' }}>
                      {test.name}
                    </td>
                    <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', textAlign: 'center', fontWeight: '600' }}>
                      {formatResult(test.result)}
                    </td>
                    <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', textAlign: 'center', color: '#475569', fontSize: '11px' }}>
                      {test.normalRange ?? '—'}
                    </td>
                    <td style={{ border: '1px solid #94a3b8', padding: '6px 10px', textAlign: 'center', color: '#64748b' }}>
                      {test.unit ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Footer */}
        <div style={{
          marginTop: '32px',
          paddingTop: '12px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#94a3b8',
        }}>
          <span>
            Laborant:{' '}
            {data.labTech ? data.labTech.name : '___________________________'}
          </span>
          <span>
            Chop etilgan: {new Date(data.printedAt).toLocaleString('ru-RU')}
          </span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
