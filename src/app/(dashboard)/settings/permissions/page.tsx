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
  Copy,
} from 'lucide-react';
import { MANAGED_PAGES } from '@/config/nav-pages';

// --- Types --------------------------------------------------------------------

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
  userMap: Record<string, { canAccess: boolean; level: string }>;
}

type Level = 'VIEW' | 'EDIT' | 'HIDDEN';

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

// --- Radio square -------------------------------------------------------------

function RadioSquare({
  checked,
  color,
  onClick,
  disabled,
}: {
  checked: boolean;
  color: 'blue' | 'green' | 'red';
  onClick: () => void;
  disabled?: boolean;
}) {
  const colors = {
    blue: checked
      ? 'bg-blue-500 border-blue-500'
      : 'bg-white border-slate-300 hover:border-blue-400',
    green: checked
      ? 'bg-green-500 border-green-500'
      : 'bg-white border-slate-300 hover:border-green-400',
    red: checked
      ? 'bg-red-500 border-red-500'
      : 'bg-white border-slate-300 hover:border-red-400',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${colors[color]} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {checked && (
        <svg viewBox="0 0 10 10" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1.5,5 4,7.5 8.5,2.5" />
        </svg>
      )}
    </button>
  );
}

// --- Helper -------------------------------------------------------------------

function getLevel(
  page: string,
  selections: Record<string, Level>,
): Level {
  return selections[page] ?? 'HIDDEN';
}

// --- Main Component -----------------------------------------------------------

export default function PermissionsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [permData, setPermData] = useState<PermData | null>(null);
  const [permLoading, setPermLoading] = useState(false);

  // selections: page/actionKey → Level
  const [selections, setSelections] = useState<Record<string, Level>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  // -- Staff list --------------------------------------------------------------

  useEffect(() => {
    if (!isAdmin) return;
    setStaffLoading(true);
    fetch('/api/staff')
      .then((r) => r.json())
      .then((d) => setStaff(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => setStaff([]))
      .finally(() => setStaffLoading(false));
  }, [isAdmin]);

  // -- Fetch permissions -------------------------------------------------------

  const buildSelections = (userMap: Record<string, { canAccess: boolean; level: string }>): Record<string, Level> => {
    const s: Record<string, Level> = {};
    for (const [page, entry] of Object.entries(userMap)) {
      if (!entry.canAccess) {
        s[page] = 'HIDDEN';
      } else {
        s[page] = entry.level === 'VIEW' ? 'VIEW' : 'EDIT';
      }
    }
    return s;
  };

  const fetchPerms = useCallback(async (userId: string) => {
    setPermLoading(true);
    setPermData(null);
    setSelections({});
    setDirty(false);
    try {
      const res = await fetch(`/api/staff/${userId}/permissions`);
      if (!res.ok) throw new Error();
      const data: PermData = await res.json();
      setPermData(data);
      setSelections(buildSelections(data.userMap));
    } catch {
      setPermData(null);
    } finally {
      setPermLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchPerms(selectedId);
  }, [selectedId, fetchPerms]);

  // -- Select ------------------------------------------------------------------

  function select(key: string, level: Level) {
    setSelections((prev) => ({ ...prev, [key]: level }));
    setDirty(true);
    setSavedAt(null);
  }

  // -- Save --------------------------------------------------------------------

  async function save() {
    if (!selectedId || !permData) return;
    setSaving(true);
    try {
      // Collect all keys that exist in selections or in userMap
      const allKeys = new Set([
        ...Object.keys(permData.userMap),
        ...Object.keys(selections),
      ]);

      const permissions: { page: string; canAccess: boolean | null; level?: string }[] = [];

      for (const key of allKeys) {
        const level = selections[key] ?? 'HIDDEN';
        if (level === 'HIDDEN') {
          // Ko'rinmasin = override o'chir (null → rol default)
          permissions.push({ page: key, canAccess: null });
        } else {
          permissions.push({ page: key, canAccess: true, level });
        }
      }

      const res = await fetch(`/api/staff/${selectedId}/permissions/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });

      if (!res.ok) throw new Error();
      setDirty(false);
      setSavedAt(new Date());
      await fetchPerms(selectedId);
    } catch {
      // keep dirty
    } finally {
      setSaving(false);
    }
  }

  // -- Reset -------------------------------------------------------------------

  function resetSelections() {
    if (!permData) return;
    setSelections(buildSelections(permData.userMap));
    setDirty(false);
  }

  // -- Template ----------------------------------------------------------------

  async function loadTemplate(templateUserId: string) {
    setTemplateLoading(true);
    setShowTemplateMenu(false);
    try {
      const res = await fetch(`/api/staff/${templateUserId}/permissions`);
      if (!res.ok) return;
      const data: PermData = await res.json();
      setSelections(buildSelections(data.userMap));
      setDirty(true);
      setSavedAt(null);
    } finally {
      setTemplateLoading(false);
    }
  }

  // -- Guard -------------------------------------------------------------------

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

  const filteredStaff = staff.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (ROLE_LABELS[s.role] ?? s.role).toLowerCase().includes(q)
    );
  });

  const isAdminUser = permData?.role === 'ADMIN';

  // -- Render ------------------------------------------------------------------

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
            <p className="text-sm text-slate-500 mt-0.5">Xodim tanlang va ruxsatlarini sozlang</p>
          </div>
        </div>

        {selectedId && dirty && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetSelections}
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
        {/* -- Left: Staff list ------------------------------------------------ */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
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
                const initials = s.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedId(s.id); setShowTemplateMenu(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                        : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {initials || <User size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                        {s.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {ROLE_LABELS[s.role] ?? s.role}
                        {!s.isActive && <span className="ml-1 text-red-400">(nofaol)</span>}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* -- Right: Permission table ----------------------------------------- */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User size={28} className="text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">Xodimni tanlang</p>
                <p className="text-sm text-slate-400 mt-1">Chapdan xodim tanlang — ruxsatlar ko&apos;rinadi</p>
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
              {/* User info bar */}
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                  {permData.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{permData.name}</p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[permData.role] ?? permData.role}</p>
                </div>

                {/* Shablon olish */}
                {!isAdminUser && (
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowTemplateMenu((v) => !v)}
                      disabled={templateLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 border border-purple-200 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-60"
                    >
                      <Copy size={12} />
                      {templateLoading ? 'Yuklanmoqda...' : 'Shablon olish'}
                    </button>

                    {showTemplateMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowTemplateMenu(false)} />
                        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                          <div className="px-3 py-2 bg-purple-50 border-b border-purple-100 text-xs font-semibold text-purple-700">
                            Xuddi shu lavozim
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {staff.filter((s) => s.id !== selectedId && s.role === permData.role).length === 0 ? (
                              <p className="text-sm text-slate-400 px-3 py-3 text-center">Xuddi shu lavozimdagi boshqa xodim yo&apos;q</p>
                            ) : (
                              staff.filter((s) => s.id !== selectedId && s.role === permData.role).map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => loadTemplate(s.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-purple-50 transition-colors border-b border-slate-50"
                                >
                                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                                    {s.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm text-slate-700 font-medium truncate">{s.name}</p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                            Boshqa lavozimlar
                          </div>
                          <div className="max-h-36 overflow-y-auto">
                            {staff.filter((s) => s.id !== selectedId && s.role !== permData.role).map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => loadTemplate(s.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50"
                              >
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                                  {s.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-600 truncate">{s.name}</p>
                                  <p className="text-[10px] text-slate-400">{ROLE_LABELS[s.role] ?? s.role}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Bo&apos;lim / Amal
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-blue-600 uppercase tracking-wide w-28">
                        Ko&apos;rinsin
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-600 uppercase tracking-wide w-28">
                        Tahrirlasin
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-red-500 uppercase tracking-wide w-28">
                        Ko&apos;rinmasin
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MANAGED_PAGES.map((page, idx) => {
                      const isExpanded = expanded[page.path] ?? false;
                      const hasActions = (page.actions?.length ?? 0) > 0;
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
                      const level = getLevel(page.path, selections);

                      return (
                        <Fragment key={page.path}>
                          {/* Page row */}
                          <tr className={`border-b border-slate-100 ${rowBg} hover:bg-blue-50/20 transition-colors`}>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {hasActions ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpanded((prev) => ({ ...prev, [page.path]: !prev[page.path] }))}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                  >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                ) : (
                                  <span className="w-[14px]" />
                                )}
                                <span className="font-semibold text-slate-700">{page.label}</span>
                                <span className="text-xs text-slate-400 font-mono">{page.path}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                <RadioSquare
                                  checked={level === 'VIEW'}
                                  color="blue"
                                  disabled={isAdminUser}
                                  onClick={() => select(page.path, level === 'VIEW' ? 'HIDDEN' : 'VIEW')}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                <RadioSquare
                                  checked={level === 'EDIT'}
                                  color="green"
                                  disabled={isAdminUser}
                                  onClick={() => select(page.path, level === 'EDIT' ? 'HIDDEN' : 'EDIT')}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                <RadioSquare
                                  checked={level === 'HIDDEN'}
                                  color="red"
                                  disabled={isAdminUser}
                                  onClick={() => select(page.path, 'HIDDEN')}
                                />
                              </div>
                            </td>
                          </tr>

                          {/* Action rows */}
                          {hasActions && isExpanded && page.actions!.map((action) => {
                            const actionKey = `${page.path}:${action.key}`;
                            const actionLevel = getLevel(actionKey, selections);

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
                                  <div className="flex justify-center">
                                    <RadioSquare
                                      checked={actionLevel === 'VIEW'}
                                      color="blue"
                                      disabled={isAdminUser}
                                      onClick={() => select(actionKey, actionLevel === 'VIEW' ? 'HIDDEN' : 'VIEW')}
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex justify-center">
                                    <RadioSquare
                                      checked={actionLevel === 'EDIT'}
                                      color="green"
                                      disabled={isAdminUser}
                                      onClick={() => select(actionKey, actionLevel === 'EDIT' ? 'HIDDEN' : 'EDIT')}
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex justify-center">
                                    <RadioSquare
                                      checked={actionLevel === 'HIDDEN'}
                                      color="red"
                                      disabled={isAdminUser}
                                      onClick={() => select(actionKey, 'HIDDEN')}
                                    />
                                  </div>
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

              {/* Save bar */}
              {dirty && (
                <div className="px-5 py-3 border-t border-slate-200 bg-amber-50 flex items-center justify-between">
                  <p className="text-sm text-amber-700 font-medium">O&apos;zgarishlar saqlanmagan</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetSelections}
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
