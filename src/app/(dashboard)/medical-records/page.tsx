'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import Link from 'next/link';
import {
  Search,
  FileText,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Stethoscope,
  ExternalLink,
} from 'lucide-react';

// --- Types -------------------------------------------------------------------

interface PatientSuggestion {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
}

interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string | null;
  treatment: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  doctor: {
    name: string;
    role: string;
  };
}

interface ApiResponse {
  data: MedicalRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Status badge helper ------------------------------------------------------

function DiagnosisBadge({ diagnosis }: { diagnosis: string | null }) {
  if (!diagnosis) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 max-w-[200px] truncate" title={diagnosis}>
      {diagnosis}
    </span>
  );
}

// --- Main Page ----------------------------------------------------------------

export default function MedicalRecordsPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();

  // Search & filter state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [suggestions, setSuggestions] = useState<PatientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Records state
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const LIMIT = 20;

  // --- Load medical records -------------------------------------------------

  const loadRecords = useCallback(async (currentPage: number, patientId?: string | null) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(LIMIT),
      });
      if (patientId) params.set('patientId', patientId);

      const res = await fetch(`/api/medical-records?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || t.common.error);
      }
      const data: ApiResponse = await res.json();
      setRecords(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    loadRecords(page, selectedPatientId);
  }, [page, selectedPatientId, loadRecords]);

  // --- Patient search / suggestions ----------------------------------------

  useEffect(() => {
    if (!patientSearch || patientSearch.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          // API may return array or paginated object
          const list: PatientSuggestion[] = Array.isArray(data) ? data : (data.data ?? []);
          setSuggestions(list);
          setShowSuggestions(true);
        }
      } catch {
        // ignore suggestion errors
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearch]);

  function selectPatient(patient: PatientSuggestion) {
    setSelectedPatientId(patient.id);
    setSelectedPatientName(`${patient.lastName} ${patient.firstName} ${patient.fatherName}`);
    setPatientSearch(`${patient.lastName} ${patient.firstName}`);
    setShowSuggestions(false);
    setPage(1);
  }

  function clearPatientFilter() {
    setSelectedPatientId(null);
    setSelectedPatientName('');
    setPatientSearch('');
    setSuggestions([]);
    setShowSuggestions(false);
    setPage(1);
  }

  // --- Helpers --------------------------------------------------------------

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  // --- Render ---------------------------------------------------------------

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <FileText size={22} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{t.medicalRecords.title}</h1>
        {!loading && (
          <span className="ml-auto text-sm text-slate-500">
            {t.common.total}: {total}
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="relative max-w-md">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {t.appointments.patient}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                if (!e.target.value) clearPatientFilter();
              }}
              placeholder={t.payments.searchPatient}
              className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {selectedPatientId && (
              <button
                onClick={clearPatientFilter}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
            {loadingSuggestions && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={14} />
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPatient(p)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <User size={14} className="text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-800">
                    {p.lastName} {p.firstName} {p.fatherName}
                  </span>
                  <span className="ml-auto text-slate-400 text-xs">{p.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedPatientName && (
          <p className="mt-2 text-xs text-blue-600 flex items-center gap-1">
            <User size={12} />
            {selectedPatientName}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin mr-2" size={20} />
          {t.common.loading}
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-16 text-slate-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t.medicalRecords.noRecords}</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-left border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t.common.date}</th>
                    <th className="px-4 py-3 font-medium">{t.appointments.patient}</th>
                    <th className="px-4 py-3 font-medium">{t.medicalRecords.doctor}</th>
                    <th className="px-4 py-3 font-medium">{t.medicalRecords.diagnosis}</th>
                    <th className="px-4 py-3 font-medium text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      {/* Sana */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {formatDate(record.createdAt)}
                      </td>

                      {/* Bemor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 rounded-full">
                            <User size={13} className="text-slate-500" />
                          </div>
                          <span className="font-medium text-slate-800">
                            {record.patient.lastName} {record.patient.firstName}
                          </span>
                        </div>
                      </td>

                      {/* Shifokor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Stethoscope size={14} className="text-slate-400" />
                          <span className="text-slate-700">{record.doctor.name}</span>
                        </div>
                      </td>

                      {/* Tashxis */}
                      <td className="px-4 py-3">
                        <DiagnosisBadge diagnosis={record.diagnosis} />
                      </td>

                      {/* Amallar */}
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/patients/${record.patientId}`}
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-blue-200 hover:border-blue-400"
                        >
                          <ExternalLink size={12} />
                          {t.medicalRecords.tabRecords}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-sm text-slate-500">
                {t.auditLogs.pagination
                  ? `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} / ${total}`
                  : `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} / ${total}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                  {t.common.back}
                </button>
                <span className="text-sm text-slate-600 font-medium px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t.common.next}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
