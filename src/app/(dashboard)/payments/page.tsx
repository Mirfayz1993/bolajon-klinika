'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  TrendingUp,
  Banknote,
  CreditCard,
  Clock,
  Search,
  Edit2,
  Printer,
} from 'lucide-react';

// --- Types -----------------------------------------------------------------

type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CLICK' | 'PAYME';
type PaymentCategory =
  | 'CHECKUP'
  | 'LAB_TEST'
  | 'SPEECH_THERAPY'
  | 'MASSAGE'
  | 'TREATMENT'
  | 'INPATIENT';
type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIAL' | 'CANCELLED' | 'REFUNDED';

interface Payment {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  admissionId?: string | null;
  amount: number;
  method: PaymentMethod;
  category: PaymentCategory;
  status: PaymentStatus;
  description?: string | null;
  createdAt: string;
  patient: { firstName: string; lastName: string };
  receivedBy?: { id: string; name: string; role: string } | null;
}

interface PaymentsResponse {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaymentSummary {
  totalAmount: number;
  totalCount: number;
  byMethod: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  phone: string;
}

interface NewPaymentForm {
  patientId: string;
  amount: string;
  method: PaymentMethod;
  category: PaymentCategory;
  status: PaymentStatus;
  description: string;
}

interface EditPaymentForm {
  status: PaymentStatus;
  description: string;
}

// --- Constants -------------------------------------------------------------

const LIMIT = 20;


const STATUS_CLASSES: Record<PaymentStatus, string> = {
  PAID: 'bg-green-100 text-green-800',
  PENDING: 'bg-slate-100 text-slate-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-blue-100 text-blue-800',
};

const EMPTY_FORM: NewPaymentForm = {
  patientId: '',
  amount: '',
  method: 'CASH',
  category: 'CHECKUP',
  status: 'PAID',
  description: '',
};

// --- Helpers ---------------------------------------------------------------

function formatMoney(n: number): string {
  return n.toLocaleString('uz-UZ') + " so'm";
}

// --- Component -------------------------------------------------------------

export default function PaymentsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { can } = usePermissions();

  const METHOD_LABELS = t.payments.methods as Record<string, string>;
  const CATEGORY_LABELS = t.payments.categories as Record<string, string>;
  const STATUS_LABELS = t.payments.statuses as Record<string, string>;

  // List state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Summary
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<NewPaymentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Patient search in modal
  const [patientSearch, setPatientSearch] = useState('');
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const patientDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState<EditPaymentForm>({ status: 'PAID', description: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // -- Fetch payments ------------------------------------------------------

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      if (filterMethod) params.set('method', filterMethod);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error(t.common.error);
      const json: PaymentsResponse = await res.json();
      setPayments(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterCategory, filterMethod, dateFrom, dateTo, t.common.error]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // -- Fetch summary -------------------------------------------------------

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch('/api/payments/summary?period=today');
      if (!res.ok) return;
      const json: PaymentSummary = await res.json();
      setSummary(json);
    } catch {
      console.error('Summary yuklanmadi');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // -- Patient search ------------------------------------------------------

  useEffect(() => {
    if (patientDebounce.current) clearTimeout(patientDebounce.current);
    if (!patientSearch.trim()) {
      setPatientOptions([]);
      setShowPatientDropdown(false);
      return;
    }
    patientDebounce.current = setTimeout(async () => {
      setPatientLoading(true);
      try {
        const res = await fetch(
          `/api/patients?search=${encodeURIComponent(patientSearch)}&limit=10`
        );
        if (!res.ok) return;
        const json: { data: PatientOption[] } = await res.json();
        setPatientOptions(json.data);
        setShowPatientDropdown(true);
      } catch {
        // silent
      } finally {
        setPatientLoading(false);
      }
    }, 350);
    return () => {
      if (patientDebounce.current) clearTimeout(patientDebounce.current);
    };
  }, [patientSearch]);

  const handleSelectPatient = (p: PatientOption) => {
    setSelectedPatient(p);
    setForm((prev) => ({ ...prev, patientId: p.id }));
    setPatientSearch(`${p.lastName} ${p.firstName}`);
    setShowPatientDropdown(false);
  };

  // -- Add payment ---------------------------------------------------------

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, string | number | undefined> = {
        patientId: form.patientId,
        amount: Number(form.amount),
        method: form.method,
        category: form.category,
        status: form.status,
      };
      if (form.description.trim()) body.description = form.description.trim();
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      setSelectedPatient(null);
      setPatientSearch('');
      fetchPayments();
      fetchSummary();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setSelectedPatient(null);
    setPatientSearch('');
    setFormError(null);
    setShowPatientDropdown(false);
    setShowAddModal(true);
  };

  // -- Edit payment --------------------------------------------------------

  const openEditModal = (payment: Payment) => {
    setEditingPayment(payment);
    setEditForm({
      status: payment.status,
      description: payment.description ?? '',
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const body: Record<string, string | undefined> = {
        status: editForm.status,
      };
      if (editForm.description.trim()) body.description = editForm.description.trim();
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowEditModal(false);
      fetchPayments();
      fetchSummary();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setEditSaving(false);
    }
  };

  // -- Filter reset --------------------------------------------------------

  const resetFilters = () => {
    setFilterStatus('');
    setFilterCategory('');
    setFilterMethod('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = filterStatus || filterCategory || filterMethod || dateFrom || dateTo;

  // -- Pagination ----------------------------------------------------------

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

  // -- Input class helper --------------------------------------------------

  const inputCls =
    'border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full';
  const selectCls =
    'border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';

  // -- Render --------------------------------------------------------------

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t.payments.title}</h1>
        {can('/payments:create') && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t.payments.addPayment}
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Today's income */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">{t.payments.todayIncome}</p>
            {summaryLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400 mt-1" />
            ) : (
              <p className="text-lg font-bold text-slate-800 truncate">
                {formatMoney(summary?.totalAmount ?? 0)}
              </p>
            )}
          </div>
        </div>

        {/* Cash */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">{t.payments.cashAmount}</p>
            {summaryLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400 mt-1" />
            ) : (
              <p className="text-lg font-bold text-slate-800 truncate">
                {formatMoney(summary?.byMethod?.CASH ?? 0)}
              </p>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">{t.payments.cardAmount}</p>
            {summaryLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400 mt-1" />
            ) : (
              <p className="text-lg font-bold text-slate-800 truncate">
                {formatMoney(summary?.byMethod?.CARD ?? 0)}
              </p>
            )}
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 truncate">{t.payments.pendingAmount}</p>
            {summaryLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400 mt-1" />
            ) : (
              <p className="text-lg font-bold text-slate-800 truncate">
                {formatMoney(summary?.byStatus?.PENDING ?? 0)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className={selectCls}
          >
            <option value="">{t.payments.allStatuses}</option>
            {(Object.keys(STATUS_LABELS) as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          {/* Category */}
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
            className={selectCls}
          >
            <option value="">{t.payments.allCategories}</option>
            {(Object.keys(CATEGORY_LABELS) as PaymentCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>

          {/* Method */}
          <select
            value={filterMethod}
            onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}
            className={selectCls}
          >
            <option value="">{t.payments.allMethods}</option>
            {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>{METHOD_LABELS[m]}</option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            placeholder={t.payments.dateFrom}
            className={selectCls}
            title={t.payments.dateFrom}
          />

          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            placeholder={t.payments.dateTo}
            className={selectCls}
            title={t.payments.dateTo}
          />

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              {t.common.cancel}
            </button>
          )}
        </div>
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
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.payments.patient}</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">{t.payments.amount}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.payments.method}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.payments.category}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.common.status}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{t.common.date}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Qabul qiluvchi</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    {t.payments.noPayments}
                  </td>
                </tr>
              ) : (
                payments.map((payment, idx) => (
                  <tr
                    key={payment.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500">
                      {(page - 1) * LIMIT + idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {payment.patient.lastName} {payment.patient.firstName}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                      {formatMoney(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {METHOD_LABELS[payment.method] ?? payment.method}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {CATEGORY_LABELS[payment.category] ?? payment.category}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[payment.status] ?? 'bg-slate-100 text-slate-800'}`}
                      >
                        {STATUS_LABELS[payment.status] ?? payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(payment.createdAt).toLocaleDateString('uz-UZ')}{' '}
                      <span className="text-slate-400">
                        {new Date(payment.createdAt).toLocaleTimeString('uz-UZ', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {payment.receivedBy ? (
                        <span className="text-slate-700 font-medium">{payment.receivedBy.name}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/payments/print?id=${payment.id}`)}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="Chek chop etish"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {can('/payments:edit') && (
                          <button
                            onClick={() => openEditModal(payment)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title={t.common.edit}
                          >
                            <Edit2 className="w-4 h-4" />
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
        {!loading && payments.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {t.common.total}: {total} {t.payments.totalPayments}
              {summary && (
                <span className="ml-3 font-semibold text-slate-700">
                  | {formatMoney(summary.totalAmount)}
                </span>
              )}
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

      {/* -- Add Payment Modal ----------------------------------------------- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{t.payments.addPayment}</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 flex flex-col gap-4">
              {formError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Patient search */}
              <div className="flex flex-col gap-1 relative">
                <label className="text-sm font-medium text-slate-700">
                  {t.payments.patient} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t.payments.searchPatient}
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      if (!e.target.value) {
                        setSelectedPatient(null);
                        setForm((prev) => ({ ...prev, patientId: '' }));
                      }
                    }}
                    required={!form.patientId}
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {patientLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                  )}
                </div>
                {showPatientDropdown && patientOptions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {patientOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPatient(p)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                      >
                        <span className="font-medium text-slate-800">
                          {p.lastName} {p.firstName} {p.fatherName}
                        </span>
                        <span className="ml-2 text-slate-500 text-xs">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatient && (
                  <p className="text-xs text-green-600 mt-0.5">
                    {t.payments.selected}{selectedPatient.lastName} {selectedPatient.firstName}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.payments.amount} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                  placeholder="0"
                  className={inputCls}
                />
              </div>

              {/* Method */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.payments.method} <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.method}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))
                  }
                  required
                  className={inputCls}
                >
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.payments.category} <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value as PaymentCategory }))
                  }
                  required
                  className={inputCls}
                >
                  {(Object.keys(CATEGORY_LABELS) as PaymentCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.common.status} <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as PaymentStatus }))
                  }
                  required
                  className={inputCls}
                >
                  {(Object.keys(STATUS_LABELS) as PaymentStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.payments.description}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.patientId}
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

      {/* -- Edit Payment Modal ---------------------------------------------- */}
      {showEditModal && editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{t.payments.editPayment}</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
              {editError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {editError}
                </div>
              )}

              {/* Read-only info */}
              <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700 flex flex-col gap-1">
                <span>
                  <span className="font-medium">{t.payments.patient}:</span>{' '}
                  {editingPayment.patient.lastName} {editingPayment.patient.firstName}
                </span>
                <span>
                  <span className="font-medium">{t.payments.amount}:</span>{' '}
                  {formatMoney(editingPayment.amount)}
                </span>
                <span>
                  <span className="font-medium">{t.payments.method}:</span>{' '}
                  {METHOD_LABELS[editingPayment.method]}
                </span>
                <span>
                  <span className="font-medium">{t.payments.category}:</span>{' '}
                  {CATEGORY_LABELS[editingPayment.category]}
                </span>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.common.status}
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, status: e.target.value as PaymentStatus }))
                  }
                  className={inputCls}
                >
                  {(Object.keys(STATUS_LABELS) as PaymentStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.payments.description}
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
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
