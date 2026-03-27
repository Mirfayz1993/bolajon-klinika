"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { Search, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  details: unknown;
  createdAt: string;
  user: { name: string; role: string } | null;
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  HEAD_DOCTOR: 'bg-red-100 text-red-700',
  DOCTOR: 'bg-blue-100 text-blue-800',
  HEAD_NURSE: 'bg-green-100 text-green-700',
  NURSE: 'bg-green-100 text-green-800',
  HEAD_LAB_TECH: 'bg-purple-100 text-purple-700',
  LAB_TECH: 'bg-purple-100 text-purple-800',
  RECEPTIONIST: 'bg-yellow-100 text-yellow-800',
  SPEECH_THERAPIST: 'bg-orange-100 text-orange-800',
  MASSAGE_THERAPIST: 'bg-pink-100 text-pink-800',
  SANITARY_WORKER: 'bg-slate-100 text-slate-700',
};

function getRoleBadgeClass(role: string): string {
  return ROLE_BADGE_CLASSES[role] ?? 'bg-slate-100 text-slate-700';
}

const LIMIT = 50;

export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [userIdFilter, setUserIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  // Applied filter state (only changes on search submit)
  const [appliedUserId, setAppliedUserId] = useState('');
  const [appliedAction, setAppliedAction] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const fetchLogs = useCallback(
    async (currentPage: number) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(LIMIT),
        });
        if (appliedUserId) params.set('userId', appliedUserId);
        if (appliedAction) params.set('action', appliedAction);
        if (appliedFrom) params.set('from', appliedFrom);
        if (appliedTo) params.set('to', appliedTo);

        const res = await fetch(`/api/audit-logs?${params.toString()}`);
        if (!res.ok) throw new Error('Server error');
        const json: AuditLogsResponse = await res.json();
        setLogs(json.data ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      } catch {
        setFetchError('Xatolik yuz berdi');
      } finally {
        setLoading(false);
      }
    },
    [appliedUserId, appliedAction, appliedFrom, appliedTo],
  );

  useEffect(() => {
    if (session?.user && session.user.role === 'ADMIN') {
      fetchLogs(page);
    }
  }, [session, page, fetchLogs]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedUserId(userIdFilter);
    setAppliedAction(actionFilter);
    setAppliedFrom(fromFilter);
    setAppliedTo(toFilter);
    setPage(1);
  }

  // Loading session
  if (status === 'loading') {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <span className="text-slate-500 text-sm">{t.common.loading}</span>
      </div>
    );
  }

  // Access denied for non-ADMIN
  const userRole = session?.user?.role;
  if (!session || userRole !== 'ADMIN') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] gap-3">
        <ShieldAlert size={40} className="text-red-400" />
        <p className="text-lg font-semibold text-slate-700">
          {t.auditLogs?.accessDenied ?? 'Ruxsat yo\'q'}
        </p>
      </div>
    );
  }

  const startRow = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const endRow = Math.min(page * LIMIT, total);

  return (
    <div className="p-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        {t.auditLogs?.title ?? 'Audit Log'}
      </h1>

      {/* Filter panel */}
      <form
        onSubmit={handleSearch}
        className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 mb-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t.auditLogs?.userId ?? 'Foydalanuvchi ID'}
            </label>
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              placeholder={t.auditLogs?.userId ?? 'Foydalanuvchi ID'}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t.auditLogs?.action ?? 'Harakat'}
            </label>
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder={t.auditLogs?.action ?? 'Harakat'}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t.auditLogs?.from ?? 'Dan'}
            </label>
            <input
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t.auditLogs?.to ?? 'Gacha'}
            </label>
            <input
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Search size={15} />
            {t.auditLogs?.search ?? 'Qidirish'}
          </button>
        </div>
      </form>

      {/* Fetch error banner */}
      {fetchError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {fetchError}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          {t.common.loading}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          {t.auditLogs?.noRecords ?? 'Yozuvlar topilmadi'}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {t.auditLogs?.dateTime ?? 'Sana/Vaqt'}
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {t.auditLogs?.user ?? 'Foydalanuvchi'}
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {t.auditLogs?.action ?? 'Harakat'}
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {t.auditLogs?.details ?? 'Tafsilotlar'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const detailsStr =
                    log.details != null
                      ? JSON.stringify(log.details, null, 2)
                      : '';
                  const truncated =
                    detailsStr.length > 100
                      ? detailsStr.slice(0, 100) + '…'
                      : detailsStr;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {new Date(log.createdAt).toLocaleString('uz-UZ')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.user ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-800">
                              {log.user.name}
                            </span>
                            <span
                              className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeClass(log.user.role)}`}
                            >
                              {(t.roles as Record<string, string>)?.[log.user.role] ??
                                log.user.role}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {truncated ? (
                          <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all font-mono">
                            {truncated}
                          </pre>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-slate-500">
            {startRow}–{endRow} {t.auditLogs?.pagination ?? 'dan tasi'}{' '}
            {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
              {t.auditLogs?.prev ?? 'Oldingi'}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.auditLogs?.next ?? 'Keyingi'}
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
