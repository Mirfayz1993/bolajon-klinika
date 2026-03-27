'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  UserPlus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES = [
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
];

const EMPTY_FORM: StaffFormData = {
  firstName: '',
  lastName: '',
  phone: '+998',
  password: '',
  role: 'DOCTOR',
  specializationId: '',
  isActive: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const isAdmin = session?.user?.role === 'ADMIN';
  const ROLE_LABELS = t.roles as Record<string, string>;

  // List state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/staff?${params.toString()}`);
      if (!res.ok) throw new Error('Serverdan xatolik');
      const data: StaffMember[] = await res.json();
      setStaff(data);
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, t.common.error]);

  const fetchSpecializations = useCallback(async () => {
    try {
      const res = await fetch('/api/specializations');
      if (!res.ok) return;
      const data: Specialization[] = await res.json();
      setSpecializations(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchSpecializations();
  }, [fetchSpecializations]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openAddModal() {
    setEditingStaff(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(member: StaffMember) {
    setEditingStaff(member);
    const [firstName = '', ...rest] = member.name.split(' ');
    const lastName = rest.join(' ');
    setForm({
      firstName,
      lastName,
      phone: member.phone,
      password: '',
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

  // ── CRUD ───────────────────────────────────────────────────────────────────

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
      const url = editingStaff ? `/api/staff/${editingStaff.id}` : '/api/staff';
      const method = editingStaff ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? t.common.error);
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
      if (!res.ok) throw new Error(t.common.error);
      fetchStaff();
    } catch {
      alert(t.common.error);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t.staff.title}</h1>
        {isAdmin && (
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
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {t.staff.noStaff}
          </div>
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
                  {isAdmin && (
                    <th className="px-5 py-3 font-medium text-right">{t.common.actions}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {staff.map((member, idx) => (
                  <tr
                    key={member.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-slate-400">{idx + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{member.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{member.phone}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {ROLE_LABELS[member.role] ?? member.role}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {member.specialization?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {member.isActive ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          {t.staff.active}
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                          {t.staff.inactive}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(member)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t.common.edit}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(member)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t.common.delete}
                          >
                            <Trash2 size={15} />
                          </button>
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                {editingStaff ? t.staff.editStaff : t.staff.addStaff}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form error */}
            {formError && (
              <div className="text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Ism + Familiya */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {t.staff.firstName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {t.staff.lastName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Telefon */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t.common.phone} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+998901234567"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Parol */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t.staff.password}
                  {!editingStaff && <span className="text-red-500"> *</span>}
                  {editingStaff && (
                    <span className="text-slate-400 ml-1 font-normal">({t.staff.passwordHint})</span>
                  )}
                </label>
                <input
                  type="password"
                  required={!editingStaff}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Rol */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t.staff.role} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Mutaxassislik */}
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
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Faol/Nofaol (faqat tahrirlashda) */}
              {editingStaff && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-slate-600">{t.staff.isActive}</label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      form.isActive ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        form.isActive ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-medium ${form.isActive ? 'text-green-600' : 'text-red-500'}`}>
                    {form.isActive ? t.staff.active : t.staff.inactive}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
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
