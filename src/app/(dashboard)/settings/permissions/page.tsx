'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { ShieldCheck } from 'lucide-react';
import { MANAGED_PAGES as PAGES } from '@/config/nav-pages';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  'ADMIN',
  'HEAD_DOCTOR',
  'DOCTOR',
  'HEAD_NURSE',
  'NURSE',
  'HEAD_LAB_TECH',
  'LAB_TECH',
  'RECEPTIONIST',
  'SPEECH_THERAPIST',
  'MASSAGE_THERAPIST',
  'SANITARY_WORKER',
] as const;

type Role = (typeof ROLES)[number];

// permissions[page][role] = boolean
type PermissionsMap = Record<string, Record<Role, boolean>>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();

  const isAdmin = session?.user?.role === 'ADMIN';

  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/permissions');
      if (!res.ok) throw new Error();
      const json = await res.json();
      const data: PermissionsMap = json.data ?? json;
      setPermissions(data);
    } catch {
      // keep empty map — table will show unchecked state
      setFetchError('Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // ── Toggle ─────────────────────────────────────────────────────────────────

  async function handleToggle(page: string, role: Role) {
    if (role === 'ADMIN') return; // ADMIN always has access — disabled

    const current = permissions[page]?.[role] ?? false;
    const updated: PermissionsMap = {
      ...permissions,
      [page]: {
        ...(permissions[page] ?? {}),
        [role]: !current,
      } as Record<Role, boolean>,
    };

    setPermissions(updated);

    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, role, canAccess: !current }),
      });
      if (!res.ok) throw new Error();

      // Show "Saqlandi" badge for 2 seconds
      const key = `${page}__${role}`;
      setSavedKey(key);
      setTimeout(() => setSavedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // Revert on error
      setPermissions(permissions);
    }
  }

  // ── Access guard ───────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-red-500" />
          </div>
          <p className="text-lg font-semibold text-slate-700">
            {(t as { permissions?: { accessDenied?: string } }).permissions?.accessDenied ?? "Ruxsat yo&apos;q"}
          </p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const tPerms = (t as { permissions?: { title?: string; saved?: string; page?: string } }).permissions;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <ShieldCheck size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {tPerms?.title ?? 'Ruxsatlar boshqaruvi'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Har bir rol uchun sahifa ruxsatlarini boshqaring
          </p>
        </div>
      </div>

      {/* Fetch error banner */}
      {!loading && fetchError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {fetchError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse w-full">
              {/* Sticky header */}
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap sticky left-0 bg-slate-50 border-r border-slate-200 min-w-[140px]">
                    {tPerms?.page ?? 'Sahifa'}
                  </th>
                  {ROLES.map((role) => (
                    <th
                      key={role}
                      className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap min-w-[90px]"
                    >
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          role === 'ADMIN'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {role.replace(/_/g, ' ')}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {PAGES.map((page, pageIdx) => (
                  <tr
                    key={page.path}
                    className={`border-b border-slate-100 last:border-0 ${
                      pageIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    } hover:bg-blue-50/30 transition-colors`}
                  >
                    {/* Page name — sticky left */}
                    <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-inherit border-r border-slate-200 whitespace-nowrap">
                      <span className="text-slate-400 text-xs mr-2">{page.path}</span>
                      <span>{page.label}</span>
                    </td>

                    {/* Role toggles */}
                    {ROLES.map((role) => {
                      const isAdminRole = role === 'ADMIN';
                      const allowed = isAdminRole
                        ? true
                        : (permissions[page.path]?.[role] ?? false);
                      const key = `${page.path}__${role}`;
                      const justSaved = savedKey === key;

                      return (
                        <td key={role} className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {/* Toggle switch */}
                            <button
                              type="button"
                              disabled={isAdminRole}
                              onClick={() => handleToggle(page.path, role)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
                                isAdminRole
                                  ? 'cursor-not-allowed opacity-70 bg-blue-400'
                                  : allowed
                                  ? 'bg-green-500 cursor-pointer'
                                  : 'bg-slate-300 cursor-pointer'
                              }`}
                              title={
                                isAdminRole
                                  ? 'ADMIN har doim ruxsatga ega'
                                  : allowed
                                  ? 'Ruxsat bor — o\'chirish uchun bosing'
                                  : 'Ruxsat yo\'q — yoqish uchun bosing'
                              }
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  allowed ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>

                            {/* "Saqlandi" badge */}
                            {justSaved && (
                              <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full leading-none animate-pulse">
                                {tPerms?.saved ?? 'Saqlandi'} ✓
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-7 h-4 rounded-full bg-green-500" />
          <span>Ruxsat bor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-7 h-4 rounded-full bg-slate-300" />
          <span>Ruxsat yo&apos;q</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-7 h-4 rounded-full bg-blue-400 opacity-70" />
          <span>ADMIN (o&apos;zgartirib bo&apos;lmaydi)</span>
        </div>
      </div>
    </div>
  );
}
