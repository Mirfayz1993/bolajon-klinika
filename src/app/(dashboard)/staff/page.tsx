'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import {
  UserPlus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronDown,
  Eye,
  EyeOff,
  ShieldCheck,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { MANAGED_PAGES } from '@/config/nav-pages';

// --- Types --------------------------------------------------------------------

interface Specialization {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
  isActive: boolean;
  specializationId?: string | null;
  plainPassword?: string | null;
  specialization?: { id: string; name: string } | null;
  createdAt: string;
}

interface StaffFormData {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  role: string;
  specializationId: string;
  isActive: boolean;
}

interface UserPermsData {
  userId: string;
  name: string;
  role: string;
  roleMap: Record<string, boolean>;
  userMap: Record<string, boolean>;
}

// --- Constants ----------------------------------------------------------------

const ALL_ROLES = [
  'ADMIN', 'HEAD_DOCTOR', 'DOCTOR', 'HEAD_NURSE', 'NURSE',
  'HEAD_LAB_TECH', 'LAB_TECH', 'RECEPTIONIST',
  'SPEECH_THERAPIST', 'MASSAGE_THERAPIST', 'SANITARY_WORKER', 'PHARMACIST',
];

const EMPTY_FORM: StaffFormData = {
  firstName: '', lastName: '', phone: '+998', password: '',
  role: 'DOCTOR', specializationId: '', isActive: true,
};

// --- Permission Drawer --------------------------------------------------------

function PermDrawer({
  member,
  onClose,
}: {
  member: StaffMember;
  onClose: () => void;
}) {
  const [data, setData] = useState<UserPermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchPerms = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/staff/${member.id}/permissions`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [member.id]);

  useEffect(() => { fetchPerms(); }, [fetchPerms]);

  async function toggle(page: string, current: boolean | null, roleDefault: boolean) {
    if (!data) return;
    setSaving(page);

    // Cycle: roleDefault → override(opposite) → clear(back to role)
    // If no override: set override to opposite of roleDefault
    // If override same as roleDefault: set override to opposite
    // If override exists: clear it (use role default)
    const hasOverride = data.userMap[page] !== undefined;

    if (hasOverride) {
      // Clear override → back to role default
      await fetch(`/api/staff/${member.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, clear: true }),
      });
      setData((prev) => {
        if (!prev) return prev;
        const newUserMap = { ...prev.userMap };
        delete newUserMap[page];
        return { ...prev, userMap: newUserMap };
      });
    } else {
      // Set override to opposite of roleDefault
      const newVal = !roleDefault;
      await fetch(`/api/staff/${member.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, canAccess: newVal }),
      });
      setData((prev) => prev ? { ...prev, userMap: { ...prev.userMap, [page]: newVal } } : prev);
    }

    setSaving(null);
  }

  function getEffective(page: string, data: UserPermsData): { value: boolean; source: 'user' | 'role' | 'default' } {
    if (data.userMap[page] !== undefined) return { value: data.userMap[page], source: 'user' };
    if (data.roleMap[page] !== undefined) return { value: data.roleMap[page], source: 'role' };
    return { value: member.role === 'ADMIN', source: 'default' };
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
              <ShieldCheck size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{member.name}</p>
              <p className="text-xs text-slate-500">{member.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Legend */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>Ruxsat bor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span>Taqiqlangan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span>Shaxsiy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RotateCcw size={10} />
            <span>Rol standartiga qayt</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : data ? (
            <div className="divide-y divide-slate-100">
              {MANAGED_PAGES.map((page) => {
                const eff = getEffective(page.path, data);
                const hasOverride = data.userMap[page.path] !== undefined;
                const isExpanded = expanded[page.path];
                const hasActions = (page.actions?.length ?? 0) > 0;

                return (
                  <div key={page.path}>
                    {/* Page row */}
                    <div className="flex items-center px-5 py-3 gap-3 hover:bg-slate-50">
                      {/* Expand button */}
                      {hasActions ? (
                        <button
                          onClick={() => setExpanded((p) => ({ ...p, [page.path]: !p[page.path] }))}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <span className="w-3.5" />
                      )}

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-400 mr-1.5">{page.path}</span>
                        <span className="text-sm font-medium text-slate-700">{page.label}</span>
                      </div>

                      {/* Source badge */}
                      {hasOverride && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          Shaxsiy
                        </span>
                      )}

                      {/* Toggle */}
                      <button
                        disabled={saving === page.path}
                        onClick={() => toggle(page.path, data.userMap[page.path] ?? null, data.roleMap[page.path] ?? (member.role === 'ADMIN'))}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                          saving === page.path ? 'opacity-50 cursor-wait' :
                          hasOverride ? 'cursor-pointer' : 'cursor-pointer'
                        } ${eff.value ? (hasOverride ? 'bg-orange-400' : 'bg-green-500') : 'bg-slate-300'}`}
                        title={hasOverride ? "Bosing: rol standartiga qaytarish" : `Bosing: ${eff.value ? "taqiqlash" : "ruxsat berish"}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${eff.value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>

                      {/* Reset button */}
                      {hasOverride && (
                        <button
                          onClick={() => toggle(page.path, data.userMap[page.path], data.roleMap[page.path] ?? false)}
                          title="Rol standartiga qaytarish"
                          className="text-slate-400 hover:text-blue-600"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>

                    {/* Action rows */}
                    {hasActions && isExpanded && page.actions!.map((action) => {
                      const actionKey = `${page.path}:${action.key}`;
                      const aEff = getEffective(actionKey, data);
                      const aHasOverride = data.userMap[actionKey] !== undefined;

                      return (
                        <div key={actionKey} className="flex items-center px-5 py-2.5 gap-3 bg-blue-50/30 hover:bg-blue-50/50 border-t border-slate-100/50">
                          <span className="w-3.5" />
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-slate-400 mr-1.5">{action.key}</span>
                            <span className="text-sm text-slate-600">{action.label}</span>
                          </div>
                          {aHasOverride && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              Shaxsiy
                            </span>
                          )}
                          <button
                            disabled={saving === actionKey}
                            onClick={() => toggle(actionKey, data.userMap[actionKey] ?? null, data.roleMap[actionKey] ?? false)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                              saving === actionKey ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                            } ${aEff.value ? (aHasOverride ? 'bg-orange-400' : 'bg-green-500') : 'bg-slate-300'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${aEff.value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                          {aHasOverride && (
                            <button
                              onClick={() => toggle(actionKey, data.userMap[actionKey], data.roleMap[actionKey] ?? false)}
                              title="Rol standartiga qaytarish"
                              className="text-slate-400 hover:text-blue-600"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-12 text-slate-400 text-sm">Yuklanmadi</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            🟠 Shaxsiy ruxsat rol standartini <strong>ustidan yozadi</strong>.
            Qaytarish uchun <RotateCcw size={10} className="inline" /> tugmasini bosing.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Main Component -----------------------------------------------------------

export default function StaffPage() {
  const { t } = useLanguage();
  const { can } = usePermissions();
  const ROLE_LABELS = t.roles as Record<string, string>;
  const canCreate = can('/staff:create');
  const canEdit = can('/staff:edit');
  const canDelete = can('/staff:delete');
  const canManagePerms = can('/staff:manage_permissions');
  const showActionsCol = canEdit || canDelete || canManagePerms;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  // Permissions drawer
  const [permMember, setPermMember] = useState<StaffMember | null>(null);

  // -- Fetch ------------------------------------------------------------------

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/staff?${params.toString()}`);
      if (!res.ok) throw new Error();
      setStaff(await res.json());
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, t.common.error]);

  const fetchSpecializations = useCallback(async () => {
    try {
      const res = await fetch('/api/specializations');
      if (res.ok) setSpecializations(await res.json());
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { fetchSpecializations(); }, [fetchSpecializations]);

  // -- Phone format -----------------------------------------------------------

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '');
    const national = digits.startsWith('998') ? digits.slice(3) : digits;
    let result = '+998';
    if (national.length > 0) result += ' ' + national.slice(0, 2);
    if (national.length > 2) result += ' ' + national.slice(2, 5);
    if (national.length > 5) result += ' ' + national.slice(5, 7);
    if (national.length > 7) result += ' ' + national.slice(7, 9);
    return result;
  }

  function handlePhoneInputChange(value: string): string {
    if (!value.startsWith('+998')) return '+998';
    return formatPhone(value);
  }

  // -- Modal ------------------------------------------------------------------

  function openAddModal() {
    setEditingStaff(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(member: StaffMember) {
    setEditingStaff(member);
    const [firstName = '', ...rest] = member.name.split(' ');
    setForm({
      firstName,
      lastName: rest.join(' '),
      phone: handlePhoneInputChange(member.phone || '+998'),
      password: member.plainPassword ?? '',
      role: member.role,
      specializationId: member.specializationId ?? '',
      isActive: member.isActive,
    });
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingStaff(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  // -- CRUD -------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    const body: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      role: form.role,
      specializationId: form.specializationId || null,
    };
    if (form.password.trim()) body.password = form.password.trim();
    if (editingStaff) body.isActive = form.isActive;
    try {
      const res = await fetch(editingStaff ? `/api/staff/${editingStaff.id}` : '/api/staff', {
        method: editingStaff ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? t.common.error);
      }
      closeModal();
      fetchStaff();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(member: StaffMember) {
    if (!confirm(t.staff.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/staff/${member.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchStaff();
    } catch {
      alert(t.common.error);
    }
  }

  // -- Render -----------------------------------------------------------------

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t.staff.title}</h1>
        {canCreate && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus size={16} />
            {t.staff.addStaff}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.common.search + '...'}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            <option value="">{t.staff.allRoles}</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">{t.staff.noStaff}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">{t.common.name}</th>
                  <th className="px-5 py-3 font-medium">{t.common.phone}</th>
                  <th className="px-5 py-3 font-medium">{t.staff.role}</th>
                  <th className="px-5 py-3 font-medium">{t.staff.specialization}</th>
                  <th className="px-5 py-3 font-medium">{t.common.status}</th>
                  {showActionsCol && (
                    <th className="px-5 py-3 font-medium text-right">{t.common.actions}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {staff.map((member, idx) => (
                  <tr key={member.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400">{idx + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{member.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{member.phone}</td>
                    <td className="px-5 py-3.5 text-slate-600">{ROLE_LABELS[member.role] ?? member.role}</td>
                    <td className="px-5 py-3.5 text-slate-600">{member.specialization?.name ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      {member.isActive ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">{t.staff.active}</span>
                      ) : (
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">{t.staff.inactive}</span>
                      )}
                    </td>
                    {showActionsCol && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {canManagePerms && (
                            <button
                              onClick={() => setPermMember(member)}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Ruxsatlarni boshqarish"
                            >
                              <ShieldCheck size={15} />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => openEditModal(member)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={t.common.edit}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(member)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t.common.delete}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permissions Drawer */}
      {permMember && (
        <PermDrawer member={permMember} onClose={() => setPermMember(null)} />
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                {editingStaff ? t.staff.editStaff : t.staff.addStaff}
              </h2>
              <button onClick={closeModal} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg mb-4 text-sm">{formError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {t.staff.firstName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" required value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {t.staff.lastName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" required value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t.common.phone} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" required value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: handlePhoneInputChange(e.target.value) }))}
                  placeholder="+998 90 123 45 67" maxLength={17}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t.staff.password}
                  {!editingStaff && <span className="text-red-500"> *</span>}
                  {editingStaff && <span className="text-slate-400 ml-1 font-normal">(joriy parol ko&apos;rsatilmoqda — o&apos;zgartirish mumkin)</span>}
                </label>
                <div className="relative">
                  <input
                    type={editingStaff ? 'text' : (showPassword ? 'text' : 'password')}
                    required={!editingStaff} value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  {!editingStaff && (
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t.staff.role} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required value={form.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      setForm((f) => ({
                        ...f,
                        role,
                        specializationId: (role === 'DOCTOR' || role === 'HEAD_DOCTOR') ? f.specializationId : '',
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {(form.role === 'DOCTOR' || form.role === 'HEAD_DOCTOR') && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t.staff.specialization}
                </label>
                <div className="relative">
                  <select
                    value={form.specializationId}
                    onChange={(e) => setForm((f) => ({ ...f, specializationId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    <option value="">— {t.common.all} —</option>
                    {specializations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              )}

              {editingStaff && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-slate-600">{t.staff.isActive}</label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className={`text-xs font-medium ${form.isActive ? 'text-green-600' : 'text-red-500'}`}>
                    {form.isActive ? t.staff.active : t.staff.inactive}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={closeModal}
                  className="flex-1 border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit" disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? t.common.loading : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
