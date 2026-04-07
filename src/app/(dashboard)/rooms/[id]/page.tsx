'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, BedDouble, Package, Wallet,
  Plus, Trash2, Check, X, Loader2, AlertCircle,
  User, RefreshCw, Building2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bed {
  id: string;
  roomId: string;
  bedNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
}

interface RoomDetail {
  id: string;
  floor: number;
  roomNumber: string;
  type: string;
  capacity: number;
  isActive: boolean;
  beds: Bed[];
}

interface InventoryItem {
  id: string;
  roomId: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  purchaseDate: string;
  status: 'ACTIVE' | 'WRITTEN_OFF';
  addedBy: { name: string } | null;
  createdAt: string;
}

interface Responsible {
  id: string;
  roomId: string;
  userId: string;
  assignedAt: string;
  user: { id: string; name: string; role: string; phone: string };
  assignedBy: { name: string } | null;
}

interface Expense {
  id: string;
  roomId: string;
  type: 'INVENTORY' | 'MEDICINE' | 'UTILITY';
  amount: number;
  description: string | null;
  date: string;
  createdBy: { name: string } | null;
}

interface ExpenseTotals {
  INVENTORY: number;
  MEDICINE: number;
  UTILITY: number;
  all: number;
}

interface StaffUser {
  id: string;
  name: string;
  role: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function formatSum(amount: number) {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoomDetailPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const isAdmin = session?.user?.role === 'ADMIN';

  const [tab, setTab] = useState<'beds' | 'inventory' | 'expenses' | 'settings'>('beds');

  // ── Room ──────────────────────────────────────────────────────────────────
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);

  // ── Beds ─────────────────────────────────────────────────────────────────
  const [addBedMode, setAddBedMode] = useState(false);
  const [bedNumber, setBedNumber] = useState('');
  const [bedSaving, setBedSaving] = useState(false);
  const [bedError, setBedError] = useState<string | null>(null);

  // ── Inventory ─────────────────────────────────────────────────────────────
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [invForm, setInvForm] = useState({ name: '', description: '', quantity: '1', unitPrice: '', purchaseDate: '' });
  const [invSaving, setInvSaving] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);

  // ── Expenses ──────────────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseTotals, setExpenseTotals] = useState<ExpenseTotals>({ INVENTORY: 0, MEDICINE: 0, UTILITY: 0, all: 0 });
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState<'ALL' | 'INVENTORY' | 'MEDICINE' | 'UTILITY'>('ALL');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expForm, setExpForm] = useState({ type: 'INVENTORY', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [expSaving, setExpSaving] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  // ── Responsible ───────────────────────────────────────────────────────────
  const [responsible, setResponsible] = useState<Responsible | null>(null);
  const [respLoading, setRespLoading] = useState(false);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [respSaving, setRespSaving] = useState(false);
  const [respError, setRespError] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);

  // ── Global error ──────────────────────────────────────────────────────────
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── Fetch room ────────────────────────────────────────────────────────────

  const fetchRoom = useCallback(async () => {
    setRoomLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}?include=beds`);
      if (!res.ok) throw new Error();
      const data: RoomDetail = await res.json();
      setRoom(data);
    } catch {
      setGlobalError(t.common.error);
    } finally {
      setRoomLoading(false);
    }
  }, [roomId, t.common.error]);

  // ── Fetch inventory ───────────────────────────────────────────────────────

  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/inventory`);
      if (!res.ok) throw new Error();
      const data: InventoryItem[] = await res.json();
      setInventory(data);
    } catch {
      setInvError(t.common.error);
    } finally {
      setInventoryLoading(false);
    }
  }, [roomId, t.common.error]);

  // ── Fetch expenses ────────────────────────────────────────────────────────

  const fetchExpenses = useCallback(async (filter?: string) => {
    setExpensesLoading(true);
    try {
      const urlParams = new URLSearchParams();
      if (filter && filter !== 'ALL') urlParams.set('type', filter);
      const res = await fetch(`/api/rooms/${roomId}/expenses?${urlParams}`);
      if (!res.ok) throw new Error();
      const data: { expenses: Expense[]; totals: ExpenseTotals } = await res.json();
      setExpenses(data.expenses);
      setExpenseTotals(data.totals);
    } catch {
      setExpError(t.common.error);
    } finally {
      setExpensesLoading(false);
    }
  }, [roomId, t.common.error]);

  // ── Fetch responsible ─────────────────────────────────────────────────────

  const fetchResponsible = useCallback(async () => {
    setRespLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/responsible`);
      if (!res.ok) throw new Error();
      const data: { responsible: Responsible | null } = await res.json();
      setResponsible(data.responsible);
    } catch {
      // silent
    } finally {
      setRespLoading(false);
    }
  }, [roomId]);

  // ── Fetch staff list ──────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff');
      if (!res.ok) throw new Error();
      const data: StaffUser[] = await res.json();
      setStaffList(data);
    } catch {
      // silent
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchRoom();
    fetchInventory();
    fetchExpenses();
    fetchResponsible();
    if (isAdmin) fetchStaff();
  }, [fetchRoom, fetchInventory, fetchExpenses, fetchResponsible, fetchStaff, isAdmin]);

  useEffect(() => {
    fetchExpenses(expenseFilter);
  }, [expenseFilter, fetchExpenses]);

  // ── Bed handlers ──────────────────────────────────────────────────────────

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    setBedSaving(true);
    setBedError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedNumber }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? t.common.error);
      }
      setBedNumber('');
      setAddBedMode(false);
      fetchRoom();
    } catch (err) {
      setBedError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBedSaving(false);
    }
  };

  const handleDeleteBed = async (bedId: string) => {
    if (!confirm(t.rooms.deleteBedConfirm)) return;
    try {
      const res = await fetch(`/api/beds/${bedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchRoom();
    } catch {
      setGlobalError(t.common.error);
    }
  };

  const handleChangeBedStatus = async (bedId: string, status: Bed['status']) => {
    try {
      const res = await fetch(`/api/beds/${bedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      fetchRoom();
    } catch {
      setGlobalError(t.common.error);
    }
  };

  // ── Inventory handlers ────────────────────────────────────────────────────

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvSaving(true);
    setInvError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: invForm.name,
          description: invForm.description || undefined,
          quantity: Number(invForm.quantity),
          unitPrice: invForm.unitPrice ? Number(invForm.unitPrice) : undefined,
          purchaseDate: invForm.purchaseDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? t.common.error);
      }
      setInvForm({ name: '', description: '', quantity: '1', unitPrice: '', purchaseDate: '' });
      setShowAddInventory(false);
      fetchInventory();
    } catch (err) {
      setInvError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setInvSaving(false);
    }
  };

  const handleWriteOff = async (item: InventoryItem) => {
    if (!confirm(t.rooms.inventoryWriteOffConfirm)) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/inventory/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WRITTEN_OFF' }),
      });
      if (!res.ok) throw new Error();
      fetchInventory();
    } catch {
      setInvError(t.common.error);
    }
  };

  const handleDeleteInventory = async (item: InventoryItem) => {
    if (!confirm(t.rooms.inventoryDeleteConfirm)) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/inventory/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchInventory();
    } catch {
      setInvError(t.common.error);
    }
  };

  // ── Expense handlers ──────────────────────────────────────────────────────

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpSaving(true);
    setExpError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: expForm.type,
          amount: Number(expForm.amount),
          description: expForm.description || undefined,
          date: expForm.date || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? t.common.error);
      }
      setExpForm({ type: 'INVENTORY', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setShowAddExpense(false);
      fetchExpenses(expenseFilter);
    } catch (err) {
      setExpError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setExpSaving(false);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm(t.rooms.expenseDeleteConfirm)) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/expenses/${expense.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchExpenses(expenseFilter);
    } catch {
      setExpError(t.common.error);
    }
  };

  // ── Responsible handlers ──────────────────────────────────────────────────

  const handleAssignResponsible = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setRespSaving(true);
    setRespError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/responsible`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? t.common.error);
      }
      setShowAssignForm(false);
      setSelectedUserId('');
      fetchResponsible();
    } catch (err) {
      setRespError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setRespSaving(false);
    }
  };

  // ── Expense type label ────────────────────────────────────────────────────

  const expTypeLabel = (type: string) => {
    if (type === 'INVENTORY') return t.rooms.expenseINVENTORY;
    if (type === 'MEDICINE') return t.rooms.expenseMEDICINE;
    return t.rooms.expenseUTILITY;
  };

  const expTypeBadge = (type: string) => {
    if (type === 'INVENTORY') return 'bg-blue-100 text-blue-700';
    if (type === 'MEDICINE') return 'bg-green-100 text-green-700';
    return 'bg-orange-100 text-orange-700';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (roomLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/rooms')} className="flex items-center gap-2 text-sm text-slate-600 mb-4 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> {t.rooms.backToRooms}
        </button>
        <div className="text-center py-20 text-slate-400">{t.common.error}</div>
      </div>
    );
  }

  const tabs = [
    { key: 'beds', label: t.rooms.beds, icon: BedDouble },
    { key: 'inventory', label: t.rooms.inventory, icon: Package },
    { key: 'expenses', label: t.rooms.expenses, icon: Wallet },
    { key: 'settings', label: t.rooms.responsible, icon: User },
  ] as const;

  return (
    <div className="p-6 max-w-5xl">
      {/* Back + Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/rooms')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.rooms.backToRooms}
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {t.rooms.number} {room.roomNumber}
            </h1>
            <p className="text-sm text-slate-500">
              {room.floor}{t.rooms.floorLabel} — {room.type}
              {responsible && (
                <span className="ml-3 inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  <User className="w-3 h-3" />
                  {responsible.user.name}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          <AlertCircle className="w-4 h-4" />
          {globalError}
          <button onClick={() => setGlobalError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Karavotlar ───────────────────────────────────────────────── */}
      {tab === 'beds' && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">
              {t.rooms.beds} ({room.beds.length})
            </h2>
            {isAdmin && (
              <button
                onClick={() => { setAddBedMode(true); setBedNumber(''); setBedError(null); }}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                {t.rooms.addBed}
              </button>
            )}
          </div>

          {/* Add bed form */}
          {isAdmin && addBedMode && (
            <form onSubmit={handleAddBed} className="px-6 py-4 bg-blue-50/40 border-b border-slate-100">
              {bedError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {bedError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  autoFocus
                  type="text"
                  value={bedNumber}
                  onChange={(e) => setBedNumber(e.target.value)}
                  placeholder={t.rooms.bedNumber}
                  required
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                />
                <button type="submit" disabled={bedSaving} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {bedSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t.common.save}
                </button>
                <button type="button" onClick={() => setAddBedMode(false)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium">
                  <X className="w-4 h-4" />
                  {t.common.cancel}
                </button>
              </div>
            </form>
          )}

          {room.beds.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">{t.rooms.beds}: 0</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-6 py-3">{t.rooms.bedNumber}</th>
                  <th className="px-6 py-3">{t.common.status}</th>
                  {isAdmin && <th className="px-6 py-3 text-right">{t.common.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {room.beds.map((bed) => (
                  <tr key={bed.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800">{bed.bedNumber}</td>
                    <td className="px-6 py-3">
                      {isAdmin ? (
                        <select
                          value={bed.status}
                          onChange={(e) => handleChangeBedStatus(bed.id, e.target.value as Bed['status'])}
                          className="text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="AVAILABLE">{t.rooms.status.AVAILABLE}</option>
                          <option value="OCCUPIED">{t.rooms.status.OCCUPIED}</option>
                          <option value="MAINTENANCE">{t.rooms.status.MAINTENANCE}</option>
                        </select>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          bed.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                          bed.status === 'OCCUPIED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{t.rooms.status[bed.status]}</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => handleDeleteBed(bed.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ── TAB 2: Inventar ─────────────────────────────────────────────────── */}
      {tab === 'inventory' && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">{t.rooms.inventory}</h2>
            {isAdmin && !showAddInventory && (
              <button
                onClick={() => setShowAddInventory(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                {t.rooms.addInventory}
              </button>
            )}
          </div>

          {/* Add form */}
          {isAdmin && showAddInventory && (
            <form onSubmit={handleAddInventory} className="px-6 py-5 bg-blue-50/30 border-b border-slate-100">
              {invError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {invError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t.rooms.inventoryName} *</label>
                  <input
                    autoFocus
                    type="text"
                    value={invForm.name}
                    onChange={(e) => setInvForm(p => ({ ...p, name: e.target.value }))}
                    required
                    placeholder="Masalan: Karavot, Dropper stand..."
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t.rooms.inventoryQuantity}</label>
                  <input
                    type="number"
                    min={1}
                    value={invForm.quantity}
                    onChange={(e) => setInvForm(p => ({ ...p, quantity: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t.rooms.inventoryUnitPrice}</label>
                  <input
                    type="number"
                    min={0}
                    value={invForm.unitPrice}
                    onChange={(e) => setInvForm(p => ({ ...p, unitPrice: e.target.value }))}
                    placeholder="0"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t.rooms.purchaseDate}</label>
                  <input
                    type="date"
                    value={invForm.purchaseDate}
                    onChange={(e) => setInvForm(p => ({ ...p, purchaseDate: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">{t.rooms.inventoryDescription}</label>
                  <input
                    type="text"
                    value={invForm.description}
                    onChange={(e) => setInvForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ixtiyoriy"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button type="submit" disabled={invSaving} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {invSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t.common.save}
                </button>
                <button type="button" onClick={() => { setShowAddInventory(false); setInvError(null); }} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium">
                  <X className="w-4 h-4" />
                  {t.common.cancel}
                </button>
              </div>
            </form>
          )}

          {inventoryLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : inventory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">{t.rooms.noInventory}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-6 py-3">{t.rooms.inventoryName}</th>
                    <th className="px-6 py-3">{t.rooms.inventoryQuantity}</th>
                    <th className="px-6 py-3">{t.rooms.inventoryUnitPrice}</th>
                    <th className="px-6 py-3">{t.rooms.purchaseDate}</th>
                    <th className="px-6 py-3">{t.rooms.inventoryStatus}</th>
                    {isAdmin && <th className="px-6 py-3 text-right">{t.common.actions}</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="font-medium text-slate-800">{item.name}</div>
                        {item.description && <div className="text-xs text-slate-400">{item.description}</div>}
                      </td>
                      <td className="px-6 py-3 text-slate-700">{item.quantity}</td>
                      <td className="px-6 py-3 text-slate-700">
                        {item.unitPrice ? `${formatSum(item.unitPrice)} so'm` : '—'}
                      </td>
                      <td className="px-6 py-3 text-slate-500">{formatDate(item.purchaseDate)}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          item.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status === 'ACTIVE' ? t.rooms.inventoryActive : t.rooms.inventoryWrittenOff}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {item.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleWriteOff(item)}
                                className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                                title={t.rooms.writeOff}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteInventory(item)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title={t.common.delete}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </section>
      )}

      {/* ── TAB 3: Xarajatlar ───────────────────────────────────────────────── */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { key: 'all', label: t.common.total, amount: expenseTotals.all, color: 'bg-slate-600' },
              { key: 'INVENTORY', label: t.rooms.expenseINVENTORY, amount: expenseTotals.INVENTORY, color: 'bg-blue-600' },
              { key: 'MEDICINE', label: t.rooms.expenseMEDICINE, amount: expenseTotals.MEDICINE, color: 'bg-green-600' },
              { key: 'UTILITY', label: t.rooms.expenseUTILITY, amount: expenseTotals.UTILITY, color: 'bg-orange-500' },
            ].map((card) => (
              <div key={card.key} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className={`w-2 h-2 rounded-full ${card.color} mb-2`} />
                <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                <p className="text-lg font-bold text-slate-800">{formatSum(card.amount)}</p>
                <p className="text-xs text-slate-400">so&apos;m</p>
              </div>
            ))}
          </div>

          <section className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(['ALL', 'INVENTORY', 'MEDICINE', 'UTILITY'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setExpenseFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      expenseFilter === f
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'ALL' ? t.common.all
                      : f === 'INVENTORY' ? t.rooms.expenseINVENTORY
                      : f === 'MEDICINE' ? t.rooms.expenseMEDICINE
                      : t.rooms.expenseUTILITY}
                  </button>
                ))}
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  {t.rooms.addExpense}
                </button>
              )}
            </div>

            {expensesLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : expenses.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">{t.rooms.noExpenses}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-6 py-3">{t.rooms.expenseType}</th>
                    <th className="px-6 py-3">{t.rooms.expenseDescription}</th>
                    <th className="px-6 py-3">{t.rooms.expenseAmount}</th>
                    <th className="px-6 py-3">{t.rooms.expenseDate}</th>
                    {isAdmin && <th className="px-6 py-3 text-right">{t.common.actions}</th>}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${expTypeBadge(exp.type)}`}>
                          {expTypeLabel(exp.type)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{exp.description || '—'}</td>
                      <td className="px-6 py-3 font-medium text-slate-800">{formatSum(Number(exp.amount))} so&apos;m</td>
                      <td className="px-6 py-3 text-slate-500">{formatDate(exp.date)}</td>
                      {isAdmin && (
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => handleDeleteExpense(exp)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {/* ── TAB 4: Sozlamalar (Javobgar) ────────────────────────────────────── */}
      {tab === 'settings' && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">{t.rooms.responsible}</h2>
          </div>
          <div className="p-6">
            {respLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
            ) : responsible ? (
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{responsible.user.name}</p>
                    <p className="text-sm text-slate-500">{responsible.user.role} · {responsible.user.phone}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.rooms.assignResponsible}: {formatDate(responsible.assignedAt)}
                      {responsible.assignedBy && ` · ${responsible.assignedBy.name}`}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setShowAssignForm(!showAssignForm)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t.rooms.changeResponsible}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-400 mb-4">{t.rooms.noResponsible}</p>
                {isAdmin && !showAssignForm && (
                  <button
                    onClick={() => setShowAssignForm(true)}
                    className="flex items-center gap-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg font-medium mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    {t.rooms.assignResponsible}
                  </button>
                )}
              </div>
            )}

            {/* Assign form */}
            {isAdmin && showAssignForm && (
              <form onSubmit={handleAssignResponsible} className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                {respError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {respError}
                  </div>
                )}
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.rooms.assignResponsible}</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white mb-3"
                >
                  <option value="">{t.rooms.selectStaff}</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={respSaving} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    {respSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {t.common.save}
                  </button>
                  <button type="button" onClick={() => { setShowAssignForm(false); setRespError(null); }} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium">
                    <X className="w-4 h-4" />
                    {t.common.cancel}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {/* ── Add Expense Modal ────────────────────────────────────────────────── */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{t.rooms.addExpense}</h2>
              <button onClick={() => { setShowAddExpense(false); setExpError(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              {expError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {expError}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.rooms.expenseType} *</label>
                <select
                  value={expForm.type}
                  onChange={(e) => setExpForm(p => ({ ...p, type: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="INVENTORY">{t.rooms.expenseINVENTORY}</option>
                  <option value="MEDICINE">{t.rooms.expenseMEDICINE}</option>
                  <option value="UTILITY">{t.rooms.expenseUTILITY}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.rooms.expenseAmount} *</label>
                <input
                  type="number"
                  min={1}
                  value={expForm.amount}
                  onChange={(e) => setExpForm(p => ({ ...p, amount: e.target.value }))}
                  required
                  placeholder="0"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.rooms.expenseDescription}</label>
                <input
                  type="text"
                  value={expForm.description}
                  onChange={(e) => setExpForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Ixtiyoriy izoh"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">{t.rooms.expenseDate}</label>
                <input
                  type="date"
                  value={expForm.date}
                  onChange={(e) => setExpForm(p => ({ ...p, date: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddExpense(false); setExpError(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={expSaving} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {expSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
