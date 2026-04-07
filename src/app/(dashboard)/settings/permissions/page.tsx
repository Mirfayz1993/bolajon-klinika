'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import {
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Search,
  User,
  Save,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { MANAGED_PAGES } from '@/config/nav-pages';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface PermData {
  userId: string;
  name: string;
  role: string;
  roleMap: Record<string, boolean>;
  userMap: Record<string, boolean>;
}

// Effective state for UI
// null = no override (use role default), true/false = override
type Override = boolean | null;

// ─── Role label ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  HEAD_DOCTOR: 'Bosh shifokor',
  DOCTOR: 'Shifokor',
  HEAD_NURSE: 'Bosh hamshira',
  NURSE: 'Hamshira',
  HEAD_LAB_TECH: 'Bosh laborant',
  LAB_TECH: 'Laborant',
  RECEPTIONIST: 'Qabulxona',
  SPEECH_THERAPIST: 'Logoped',
  MASSAGE_THERAPIST: 'Massajchi',
  SANITARY_WORKER: 'Sanitar',
};

// ─── Permission Toggle ────────────────────────────────────────────────────────

function PermToggle({
  override,
  roleDefault,
  onChange,
  disabled,
}: {
  override: Override;
  roleDefault: boolean;
  onChange: (val: Override) => void;
  disabled?: boolean;
}) {
  const effective = override !== null ? override : roleDefault;

  // State label
  const isInherited = override === null;
  const label = isInherited
    ? roleDefault
      ? "Rol: ruxsat bor"
      : "Rol: ruxsat yo'q"
    : override
    ? "Xususiy: ruxsat bor"
    : "Xususiy: ruxsat yo'q";

  function cycle() {
    if (disabled) return;
    // 3-state cycle: null → true → false → null
    if (override === null) onChange(true);
    else if (override === true) onChange(false);
    else onChange(null);
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={cycle}
        title={label}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
          disabled
            ? 'cursor-not-allowed opacity-60 bg-blue-400 focus:ring-blue-300'
            : effective
            ? isInherited
              ? 'bg-emerald-400 cursor-pointer focus:ring-emerald-300'
              : 'bg-green-600 cursor-pointer focus:ring-green-400'
            : isInherited
            ? 'bg-slate-300 cursor-pointer focus:ring-slate-300'
            : 'bg-red-400 cursor-pointer focus:ring-red-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            effective ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span
        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
          isInherited
            ? 'text-slate-400 bg-slate-100'
            : override
            ? 'text-green-700 bg-green-100'
            : 'text-red-600 bg-red-100'
        }`}
      >
        {isInherited ? 'Rol' : override ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  // Staff list
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Permissions for selected user
  const [permData, setPermData] = useState<PermData | null>(null);
  const [permLoading, setPermLoading] = useState(false);

  // Overrides: page → override value
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Expanded sections
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // ── Fetch staff list ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAdmin) return;
    setStaffLoading(true);
    fetch('/api/staff')
      .then((r) => r.json())
      .then((d) => setStaff(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => setStaff([]))
      .finally(() => setStaffLoading(false));
  }, [isAdmin]);

  // ── Fetch permissions for selected user ───────────────────────────────────

  const fetchPerms = useCallback(async (userId: string) => {
    setPermLoading(true);
    setPermData(null);
    setOverrides({});
    setDirty(false);
    try {
      const res = await fetch(`/api/staff/${userId}/permissions`);
      if (!res.ok) throw new Error();
      const data: PermData = await res.json();
      setPermData(data);
      // Build overrides from userMap
      const init: Record<string, Override> = {};
      for (const page of Object.keys(data.userMap)) {
        init[page] = data.userMap[page];
      }
      setOverrides(init);
    } catch {
      setPermData(null);
    } finally {
      setPermLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchPerms(selectedId);
  }, [selectedId, fetchPerms]);

  // ── Override toggle ───────────────────────────────────────────────────────

  function setOverride(page: string, val: Override) {
    setOverrides((prev) => ({ ...prev, [page]: val }));
    setDirty(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (!selectedId || !permData) return;
    setSaving(true);
    try {
      // Collect all pages + actions that have been touched
      const permissions: { page: string; canAccess: boolean | null }[] = [];

      const allKeys = new Set([
        ...Object.keys(permData.userMap),
        ...Object.keys(overrides),
      ]);

      for (const page of allKeys) {
        const override = overrides[page] ?? null;
        permissions.push({ page, canAccess: override });
      }

      const res = await fetch(`/api/staff/${selectedId}/permissions/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });

      if (!res.ok) throw new Error();

      setDirty(false);
      setSavedAt(new Date());
      // Re-fetch to sync
      await fetchPerms(selectedId);
    } catch {
      // keep dirty
    } finally {
      setSaving(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function resetOverrides() {
    if (!permData) return;
    const init: Record<string, Override> = {};
    for (const page of Object.keys(permData.userMap)) {
      init[page] = permData.userMap[page];
    }
    setOverrides(init);
    setDirty(false);
  }

  // ── Access guard ──────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-red-500" />
          </div>
          <p className="text-lg font-semibold text-slate-700">Ruxsat yo&apos;q</p>
        </div>
      </div>
    );
  }

  // ── Filter staff ──────────────────────────────────────────────────────────

  const filteredStaff = staff.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (ROLE_LABELS[s.role] ?? s.role).toLowerCase().includes(q)
    );
  });

  const selectedUser = staff.find((s) => s.id === selectedId);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <ShieldCheck size={20} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Ruxsatlar boshqaruvi</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Xodim tanlang va uning ruxsatlarini sozlang
            </p>
          </div>
        </div>

        {selectedId && dirty && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetOverrides}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={14} />
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        )}

        {savedAt && !dirty && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
            <CheckCircle2 size={14} />
            Saqlandi
          </div>
        )}
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* ── Left: Staff list ─────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Xodim qidirish..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {staffLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : filteredStaff.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Topilmadi</p>
            ) : (
              filteredStaff.map((s) => {
                const isSelected = s.id === selectedId;
                const initials = s.name
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase();
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                        : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {initials || <User size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                        {s.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {ROLE_LABELS[s.role] ?? s.role}
                        {!s.isActive && (
                          <span className="ml-1 text-red-400">(nofaol)</span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Permission grid ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User size={28} className="text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">Xodimni tanlang</p>
                <p className="text-sm text-slate-400 mt-1">
                  Chapdan xodim tanlang — ruxsatlar ko&apos;rinadi
                </p>
              </div>
            </div>
          ) : permLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : !permData ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-red-500 text-sm">Ma&apos;lumot yuklanmadi</p>
            </div>
          ) : (
            <>
              {/* User info header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                  {permData.name
                    .split(' ')
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{permData.name}</p>
                  <p className="text-xs text-slate-500">
                    {ROLE_LABELS[permData.role] ?? permData.role} — rol ruxsatlari asos,
                    <span className="text-blue-600 ml-1">xususiy o&apos;zgarishlar ustiga qo&apos;shiladi</span>
                  </p>
                </div>
              </div>

              {/* Legend */}
              <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-4 text-xs text-slate-500 bg-white flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-6 h-3.5 rounded-full bg-emerald-400 text-[8px] font-bold text-white">Rol</span>
                  <span>Rol orqali ruxsat bor (o&apos;zgartirilmagan)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-6 h-3.5 rounded-full bg-slate-300 text-[8px] font-bold text-white">Rol</span>
                  <span>Rol orqali ruxsat yo&apos;q</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-6 h-3.5 rounded-full bg-green-600 text-[8px] font-bold text-white">ON</span>
                  <span>Xususiy: yoqilgan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-6 h-3.5 rounded-full bg-red-400 text-[8px] font-bold text-white">OFF</span>
                  <span>Xususiy: o&apos;chirilgan</span>
                </div>
              </div>

              {/* Permissions table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Bo&apos;lim / Amal
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">
                        Rol (asos)
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">
                        Xususiy ruxsat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MANAGED_PAGES.map((page, idx) => {
                      const isExpanded = expanded[page.path] ?? false;
                      const hasActions = (page.actions?.length ?? 0) > 0;
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';

                      const roleDefault = permData.roleMap[page.path] ?? false;
                      const override = overrides[page.path] ?? null;
                      const effective = override !== null ? override : roleDefault;

                      return (
                        <Fragment key={page.path}>
                          {/* Page row */}
                          <tr className={`border-b border-slate-100 ${rowBg} hover:bg-blue-50/20 transition-colors`}>
                            <td className={`px-5 py-3 ${rowBg}`}>
                              <div className="flex items-center gap-2">
                                {hasActions ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpanded((prev) => ({ ...prev, [page.path]: !prev[page.path] }))
                                    }
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )}
                                  </button>
                                ) : (
                                  <span className="w-[14px]" />
                                )}
                                <span className="font-semibold text-slate-700">{page.label}</span>
                                <span className="text-xs text-slate-400 font-mono">{page.path}</span>
                              </div>
                            </td>
                            {/* Role default badge */}
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  roleDefault
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {roleDefault ? "Ha" : "Yo'q"}
                              </span>
                            </td>
                            {/* Custom override toggle */}
                            <td className="px-4 py-3 text-center">
                              <PermToggle
                                override={override}
                                roleDefault={roleDefault}
                                onChange={(val) => setOverride(page.path, val)}
                                disabled={permData.role === 'ADMIN'}
                              />
                            </td>
                          </tr>

                          {/* Action rows */}
                          {hasActions &&
                            isExpanded &&
                            page.actions!.map((action) => {
                              const actionKey = `${page.path}:${action.key}`;
                              const actionRoleDefault = permData.roleMap[actionKey] ?? effective;
                              const actionOverride = overrides[actionKey] ?? null;

                              return (
                                <tr
                                  key={actionKey}
                                  className="border-b border-slate-100 bg-blue-50/10 hover:bg-blue-50/30 transition-colors"
                                >
                                  <td className="px-5 py-2.5">
                                    <div className="flex items-center gap-2 pl-8">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                      <span className="text-slate-600">{action.label}</span>
                                      <span className="text-xs text-slate-400 font-mono">{action.key}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        actionRoleDefault
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {actionRoleDefault ? "Ha" : "Yo'q"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <PermToggle
                                      override={actionOverride}
                                      roleDefault={actionRoleDefault}
                                      onChange={(val) => setOverride(actionKey, val)}
                                      disabled={permData.role === 'ADMIN'}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Save bar (sticky bottom) */}
              {dirty && (
                <div className="px-5 py-3 border-t border-slate-200 bg-amber-50 flex items-center justify-between">
                  <p className="text-sm text-amber-700 font-medium">
                    O&apos;zgarishlar saqlanmagan
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetOverrides}
                      className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
                    >
                      Bekor qilish
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      <Save size={13} />
                      {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
