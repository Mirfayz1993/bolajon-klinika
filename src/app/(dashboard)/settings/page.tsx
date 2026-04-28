'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Tag,
  SlidersHorizontal,
  Building2,
  DoorOpen,
  Send,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// --- Types --------------------------------------------------------------------

interface Specialization {
  id: string;
  name: string;
  createdAt: string;
  _count?: { users: number };
}

interface RoomType {
  id: string;
  name: string;
  createdAt: string;
}

// --- Component ----------------------------------------------------------------

export default function SettingsPage() {
  const { t } = useLanguage();
  const { can } = usePermissions();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const canManageSpecs = can('/settings:manage_specs');
  const canManageRoomTypes = can('/settings:manage_room_types');

  // -- Telegram bog'lanish state ---------------------------------------------
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'bolajon_klinika_bot';
  const botUrl = `https://t.me/${botUsername}?start=link`;

  const fetchTelegramStatus = useCallback(async () => {
    if (!userId) return;
    setTelegramLoading(true);
    setTelegramError('');
    try {
      const res = await fetch(`/api/staff/${userId}`);
      if (!res.ok) throw new Error(t.common.error);
      const data = await res.json() as { hasTelegram?: boolean };
      setTelegramLinked(!!data.hasTelegram);
    } catch {
      setTelegramError(t.common.error);
    } finally {
      setTelegramLoading(false);
    }
  }, [userId, t.common.error]);

  useEffect(() => {
    fetchTelegramStatus();
  }, [fetchTelegramStatus]);

  async function handleDisconnectTelegram() {
    if (!userId) return;
    if (!confirm(t.telegram.disconnectConfirm)) return;
    setDisconnecting(true);
    setTelegramError('');
    try {
      const res = await fetch(`/api/staff/${userId}/telegram/disconnect`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? t.common.error);
      }
      setTelegramLinked(false);
    } catch (err) {
      setTelegramError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDisconnecting(false);
    }
  }

  // -- Specializations state --------------------------------------------------
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loadingSpecs, setLoadingSpecs] = useState(true);
  const [specsError, setSpecsError] = useState('');

  const [actionError, setActionError] = useState('');

  // Add new specialization
  const [addingSpec, setAddingSpec] = useState(false);
  const [newSpecName, setNewSpecName] = useState('');
  const [savingSpec, setSavingSpec] = useState(false);

  // Edit existing specialization
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [editingSpecName, setEditingSpecName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // -- Room Types state -------------------------------------------------------
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(true);
  const [roomTypesError, setRoomTypesError] = useState('');

  const [addingRoomType, setAddingRoomType] = useState(false);
  const [newRoomTypeName, setNewRoomTypeName] = useState('');
  const [savingRoomType, setSavingRoomType] = useState(false);

  const [editingRoomTypeId, setEditingRoomTypeId] = useState<string | null>(null);
  const [editingRoomTypeName, setEditingRoomTypeName] = useState('');
  const [savingRoomTypeEdit, setSavingRoomTypeEdit] = useState(false);

  const [roomTypeActionError, setRoomTypeActionError] = useState('');

  // -- Fetch specializations --------------------------------------------------

  const fetchSpecializations = useCallback(async () => {
    setLoadingSpecs(true);
    setSpecsError('');
    try {
      const res = await fetch('/api/specializations');
      if (!res.ok) throw new Error(t.common.error);
      const data: Specialization[] = await res.json();
      setSpecializations(data);
    } catch {
      setSpecsError(t.common.error);
    } finally {
      setLoadingSpecs(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    fetchSpecializations();
  }, [fetchSpecializations]);

  // -- Fetch room types -------------------------------------------------------

  const fetchRoomTypes = useCallback(async () => {
    setLoadingRoomTypes(true);
    setRoomTypesError('');
    try {
      const res = await fetch('/api/room-types');
      if (!res.ok) throw new Error(t.common.error);
      const data: RoomType[] = await res.json();
      setRoomTypes(data);
    } catch {
      setRoomTypesError(t.common.error);
    } finally {
      setLoadingRoomTypes(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    fetchRoomTypes();
  }, [fetchRoomTypes]);

  // -- Room Type CRUD ---------------------------------------------------------

  async function handleAddRoomType(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomTypeName.trim()) return;
    setSavingRoomType(true);
    setRoomTypeActionError('');
    try {
      const res = await fetch('/api/room-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomTypeName.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setNewRoomTypeName('');
      setAddingRoomType(false);
      fetchRoomTypes();
    } catch (err) {
      setRoomTypeActionError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSavingRoomType(false);
    }
  }

  async function handleSaveRoomType(id: string) {
    if (!editingRoomTypeName.trim()) return;
    setSavingRoomTypeEdit(true);
    setRoomTypeActionError('');
    try {
      const res = await fetch(`/api/room-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingRoomTypeName.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setEditingRoomTypeId(null);
      setEditingRoomTypeName('');
      fetchRoomTypes();
    } catch (err) {
      setRoomTypeActionError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSavingRoomTypeEdit(false);
    }
  }

  async function handleDeleteRoomType(rt: RoomType) {
    if (!confirm(t.settings.deleteRoomTypeConfirm)) return;
    setRoomTypeActionError('');
    try {
      const res = await fetch(`/api/room-types/${rt.id}`, { method: 'DELETE' });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      fetchRoomTypes();
    } catch (err) {
      setRoomTypeActionError(err instanceof Error ? err.message : t.common.error);
    }
  }

  // -- Specialization CRUD ----------------------------------------------------

  async function handleAddSpec(e: React.FormEvent) {
    e.preventDefault();
    if (!newSpecName.trim()) return;
    setSavingSpec(true);
    setActionError('');
    try {
      const res = await fetch('/api/specializations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSpecName.trim() }),
      });
      if (!res.ok) throw new Error(t.common.error);
      setNewSpecName('');
      setAddingSpec(false);
      fetchSpecializations();
    } catch {
      setActionError(t.common.error);
    } finally {
      setSavingSpec(false);
    }
  }

  function startEditSpec(spec: Specialization) {
    setEditingSpecId(spec.id);
    setEditingSpecName(spec.name);
  }

  function cancelEditSpec() {
    setEditingSpecId(null);
    setEditingSpecName('');
  }

  async function handleSaveSpec(id: string) {
    if (!editingSpecName.trim()) return;
    setSavingEdit(true);
    setActionError('');
    try {
      const res = await fetch(`/api/specializations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingSpecName.trim() }),
      });
      if (!res.ok) throw new Error(t.common.error);
      cancelEditSpec();
      fetchSpecializations();
    } catch {
      setActionError(t.common.error);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteSpec(spec: Specialization) {
    if (!confirm(t.settings.deleteSpecializationConfirm)) return;
    setActionError('');
    try {
      const res = await fetch(`/api/specializations/${spec.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t.common.error);
      fetchSpecializations();
    } catch {
      setActionError(t.common.error);
    }
  }

  // -- Render -----------------------------------------------------------------

  return (
    <div className="p-6 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <SlidersHorizontal size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t.settings.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.settings.clinicInfo}</p>
        </div>
      </div>

      <div className="space-y-6">

        {/* -- Telegram bog'lanish ------------------------------------------- */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send size={18} className="text-sky-600" />
              <h2 className="text-base font-semibold text-slate-800">
                {t.telegram.title}
              </h2>
            </div>
            <button
              onClick={fetchTelegramStatus}
              disabled={telegramLoading || !userId}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors disabled:opacity-60"
              title={t.telegram.refresh}
            >
              <RefreshCw size={14} className={telegramLoading ? 'animate-spin' : ''} />
              {t.telegram.refresh}
            </button>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm text-slate-600 mb-4">
              {t.telegram.description}
            </p>

            {telegramError && (
              <div className="mb-4 flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{telegramError}</span>
              </div>
            )}

            {/* Status + Action */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2">
                {telegramLoading && telegramLinked === null ? (
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                ) : telegramLinked ? (
                  <>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700">
                      <Check size={14} />
                    </span>
                    <span className="text-sm font-medium text-green-700">
                      {t.telegram.linked}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700">
                      <X size={14} />
                    </span>
                    <span className="text-sm font-medium text-red-700">
                      {t.telegram.notLinked}
                    </span>
                  </>
                )}
              </div>

              {telegramLinked === false && (
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Send size={14} />
                  {t.telegram.openBot}
                </a>
              )}

              {telegramLinked === true && (
                <button
                  onClick={handleDisconnectTelegram}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <X size={14} />
                  {t.telegram.disconnect}
                </button>
              )}
            </div>

            {/* Yo'riqnoma — faqat ulanmagan holatda */}
            {telegramLinked === false && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {t.telegram.instructions}
                </p>
                <ol className="space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center">1</span>
                    <span>{t.telegram.step1}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center">2</span>
                    <span>{t.telegram.step2}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center">3</span>
                    <span>{t.telegram.step3}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center">4</span>
                    <span>{t.telegram.step4}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center">5</span>
                    <span>{t.telegram.step5}</span>
                  </li>
                </ol>
              </div>
            )}
          </div>
        </section>

        {/* -- Mutaxassisliklar ---------------------------------------------- */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag size={18} className="text-blue-600" />
              <h2 className="text-base font-semibold text-slate-800">
                {t.settings.specializations}
              </h2>
            </div>
            {canManageSpecs && !addingSpec && (
              <button
                onClick={() => setAddingSpec(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <Plus size={15} />
                {t.settings.addSpecialization}
              </button>
            )}
          </div>

          {/* Errors */}
          {specsError && (
            <div className="mx-6 mt-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
              {specsError}
            </div>
          )}
          {actionError && (
            <div className="mx-6 mt-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
              {actionError}
            </div>
          )}

          {/* Add form */}
          {canManageSpecs && addingSpec && (
            <form
              onSubmit={handleAddSpec}
              className="px-6 py-4 border-b border-slate-100 bg-blue-50/40"
            >
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  autoFocus
                  value={newSpecName}
                  onChange={(e) => setNewSpecName(e.target.value)}
                  placeholder={t.settings.specializationName}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  required
                />
                <button
                  type="submit"
                  disabled={savingSpec}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Check size={14} />
                  {t.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingSpec(false); setNewSpecName(''); }}
                  className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <X size={14} />
                  {t.common.cancel}
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          {loadingSpecs ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : specializations.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              {t.settings.noSpecializations}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-6 py-3 font-medium">#</th>
                    <th className="px-6 py-3 font-medium">{t.settings.specializationName}</th>
                    <th className="px-6 py-3 font-medium">{t.staff.employeeCount}</th>
                    {canManageSpecs && (
                      <th className="px-6 py-3 font-medium text-right">{t.common.actions}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {specializations.map((spec, idx) => (
                    <tr
                      key={spec.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-3.5 text-slate-400">{idx + 1}</td>
                      <td className="px-6 py-3.5 font-medium text-slate-800">
                        {editingSpecId === spec.id ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingSpecName}
                            onChange={(e) => setEditingSpecName(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-56"
                          />
                        ) : (
                          spec.name
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {spec._count?.users ?? 0}
                      </td>
                      {canManageSpecs && (
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {editingSpecId === spec.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveSpec(spec.id)}
                                  disabled={savingEdit}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-60"
                                  title={t.common.save}
                                >
                                  <Check size={15} />
                                </button>
                                <button
                                  onClick={cancelEditSpec}
                                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                  title={t.common.cancel}
                                >
                                  <X size={15} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditSpec(spec)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title={t.common.edit}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSpec(spec)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title={t.common.delete}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
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
        </section>

        {/* -- Xona turlari -------------------------------------------------- */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorOpen size={18} className="text-violet-600" />
              <h2 className="text-base font-semibold text-slate-800">
                {t.settings.roomTypes}
              </h2>
            </div>
            {canManageRoomTypes && !addingRoomType && (
              <button
                onClick={() => setAddingRoomType(true)}
                className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
              >
                <Plus size={15} />
                {t.settings.addRoomType}
              </button>
            )}
          </div>

          {roomTypesError && (
            <div className="mx-6 mt-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
              {roomTypesError}
            </div>
          )}
          {roomTypeActionError && (
            <div className="mx-6 mt-4 text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
              {roomTypeActionError}
            </div>
          )}

          {canManageRoomTypes && addingRoomType && (
            <form
              onSubmit={handleAddRoomType}
              className="px-6 py-4 border-b border-slate-100 bg-violet-50/40"
            >
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  autoFocus
                  value={newRoomTypeName}
                  onChange={(e) => setNewRoomTypeName(e.target.value)}
                  placeholder={t.settings.roomTypeName}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                  required
                />
                <button
                  type="submit"
                  disabled={savingRoomType}
                  className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Check size={14} />
                  {t.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingRoomType(false); setNewRoomTypeName(''); }}
                  className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <X size={14} />
                  {t.common.cancel}
                </button>
              </div>
            </form>
          )}

          {loadingRoomTypes ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : roomTypes.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              {t.settings.noRoomTypes}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-6 py-3 font-medium">#</th>
                    <th className="px-6 py-3 font-medium">{t.settings.roomTypeName}</th>
                    {canManageRoomTypes && (
                      <th className="px-6 py-3 font-medium text-right">{t.common.actions}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {roomTypes.map((rt, idx) => (
                    <tr
                      key={rt.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-3.5 text-slate-400">{idx + 1}</td>
                      <td className="px-6 py-3.5 font-medium text-slate-800">
                        {editingRoomTypeId === rt.id ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingRoomTypeName}
                            onChange={(e) => setEditingRoomTypeName(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 w-56"
                          />
                        ) : (
                          rt.name
                        )}
                      </td>
                      {canManageRoomTypes && (
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {editingRoomTypeId === rt.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveRoomType(rt.id)}
                                  disabled={savingRoomTypeEdit}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-60"
                                  title={t.common.save}
                                >
                                  <Check size={15} />
                                </button>
                                <button
                                  onClick={() => { setEditingRoomTypeId(null); setEditingRoomTypeName(''); }}
                                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                  title={t.common.cancel}
                                >
                                  <X size={15} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setEditingRoomTypeId(rt.id); setEditingRoomTypeName(rt.name); }}
                                  className="p-1.5 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                  title={t.common.edit}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteRoomType(rt)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title={t.common.delete}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
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
        </section>

        {/* -- Klinika ma'lumotlari (placeholder) ---------------------------- */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Building2 size={18} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">
              {t.settings.generalSettings}
            </h2>
          </div>
          <div className="px-6 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t.settings.clinicName}
                </label>
                <div className="border border-dashed border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-400 bg-slate-50">
                  {t.settings.comingSoon}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t.settings.clinicPhone}
                </label>
                <div className="border border-dashed border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-400 bg-slate-50">
                  {t.settings.comingSoon}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {t.settings.clinicAddress}
                </label>
                <div className="border border-dashed border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-400 bg-slate-50">
                  {t.settings.comingSoon}
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
