'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Search,
  Plus,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  jshshir: string;
  birthDate: string;
  district: string | null;
  houseNumber: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  telegramChatId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PatientsResponse {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface NewPatientForm {
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
  jshshir: string;
  birthDate: string;
  district: string;
  houseNumber: string;
  medicalHistory: string;
  allergies: string;
  telegramChatId: string;
}

function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const LIMIT = 20;

const emptyForm: NewPatientForm = {
  firstName: '',
  lastName: '',
  fatherName: '',
  phone: '+998',
  jshshir: '',
  birthDate: '',
  district: '',
  houseNumber: '',
  medicalHistory: '',
  allergies: '',
  telegramChatId: '',
};

export default function PatientsPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPatientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'ADMIN';

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) params.set('search', search);
      const res = await fetch(`/api/patients?${params.toString()}`);
      if (!res.ok) throw new Error(t.common.error);
      const json: PatientsResponse = await res.json();
      setPatients(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [page, search, t.common.error]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t.patients.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t.common.error);
      fetchPatients();
    } catch {
      setError(t.common.error);
    }
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // YYYY → YYYY-01-01
      const isoDate = form.birthDate.length === 4 ? `${form.birthDate}-01-01` : form.birthDate;

      const body: Record<string, string | undefined> = {
        firstName: form.firstName,
        lastName: form.lastName,
        fatherName: form.fatherName,
        phone: form.phone || undefined,
        jshshir: form.jshshir || undefined,
        birthDate: isoDate,
      };
      if (form.district) body.district = form.district;
      if (form.houseNumber) body.houseNumber = form.houseNumber;
      if (form.medicalHistory) body.medicalHistory = form.medicalHistory;
      if (form.allergies) body.allergies = form.allergies;
      if (form.telegramChatId) body.telegramChatId = form.telegramChatId;

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowModal(false);
      setForm(emptyForm);
      fetchPatients();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const renderPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t.patients.title}</h1>
        <button
          onClick={() => { setShowModal(true); setForm(emptyForm); setFormError(null); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t.patients.addPatient}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={t.common.search + '...'}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-10">#</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.patients.fio}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.common.phone}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.patients.jshshir}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.patients.age}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.patients.birthDate}</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    {t.patients.notFound}
                  </td>
                </tr>
              ) : (
                patients.map((patient, idx) => (
                  <tr
                    key={patient.id}
                    onClick={() => router.push(`/patients/${patient.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500">
                      {(page - 1) * LIMIT + idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {patient.lastName} {patient.firstName} {patient.fatherName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{patient.phone}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {patient.jshshir}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {calcAge(patient.birthDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(patient.birthDate).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => router.push(`/patients/${patient.id}`)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title={t.common.edit}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => handleDelete(patient.id, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title={t.common.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && patients.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {t.common.total}: {total} {t.patients.totalPatients}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {renderPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-2 text-slate-400 text-sm">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(Number(p))}
                    className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors ${
                      page === p
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{t.patients.addPatient}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {formError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Last Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.patients.lastName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleFormChange}
                    required
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* First Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.patients.firstName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleFormChange}
                    required
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Father Name */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    {t.patients.fatherName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="fatherName"
                    value={form.fatherName}
                    onChange={handleFormChange}
                    required
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.common.phone}
                  </label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    placeholder="+998901234567"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* JSHSHIR */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.patients.jshshir}
                  </label>
                  <input
                    name="jshshir"
                    value={form.jshshir}
                    onChange={handleFormChange}
                    maxLength={14}
                    placeholder="14 ta raqam"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Birth Year */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Tug&apos;ilgan yil <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="birthDate"
                    value={form.birthDate}
                    onChange={handleFormChange}
                    required
                    placeholder="YYYY"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* District */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.patients.district}
                  </label>
                  <input
                    name="district"
                    value={form.district}
                    onChange={handleFormChange}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* House Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.patients.houseNumber}
                  </label>
                  <input
                    name="houseNumber"
                    value={form.houseNumber}
                    onChange={handleFormChange}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Allergies */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    {t.patients.allergies}
                  </label>
                  <textarea
                    name="allergies"
                    value={form.allergies}
                    onChange={handleFormChange}
                    rows={2}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Telegram Chat ID */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    {t.patients.telegramChatId}
                  </label>
                  <input
                    name="telegramChatId"
                    value={form.telegramChatId}
                    onChange={handleFormChange}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
