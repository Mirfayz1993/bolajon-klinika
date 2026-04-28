'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Package,
  Plus, Minus, Check, X, Loader2, AlertCircle,
  User, RefreshCw, Building2, History, BedDouble, Trash2, RotateCcw
} from 'lucide-react';
import { floorLabel } from '@/lib/utils';

// --- Types --------------------------------------------------------------------

interface RoomDetail {
  id: string;
  floor: number;
  roomNumber: string;
  type: string;
  capacity: number;
  isActive: boolean;
  deletedAt?: string | null;
}

interface BedItem {
  id: string;
  roomId: string;
  bedNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  deletedAt: string | null;
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

interface InventoryLog {
  id: string;
  action: string;
  quantity: number;
  comment: string | null;
  createdAt: string;
  inventoryItem: { name: string };
  performedBy: { name: string } | null;
}

interface Responsible {
  id: string;
  roomId: string;
  userId: string;
  assignedAt: string;
  user: { id: string; name: string; role: string; phone: string };
  assignedBy: { name: string } | null;
}

interface StaffUser {
  id: string;
  name: string;
  role: string;
}

// --- Helpers -----------------------------------------------------------------

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSum(amount: number) {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

// --- Component ---------------------------------------------------------------

export default function RoomDetailPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const isAdmin = session?.user?.role === 'ADMIN';

  const [tab, setTab] = useState<'inventory' | 'beds' | 'settings'>('inventory');

  // -- Room ------------------------------------------------------------------
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);

  // -- Inventory -------------------------------------------------------------
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [invForm, setInvForm] = useState({ name: '', description: '', quantity: '1', unitPrice: '', purchaseDate: '' });
  const [invSaving, setInvSaving] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);

  // -- Write-off modal -------------------------------------------------------
  const [showWriteOff, setShowWriteOff] = useState(false);
  const [woItemId, setWoItemId] = useState('');
  const [woQuantity, setWoQuantity] = useState('1');
  const [woComment, setWoComment] = useState('');
  const [woSaving, setWoSaving] = useState(false);
  const [woError, setWoError] = useState<string | null>(null);

  // -- Inventory logs --------------------------------------------------------
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // -- Responsible -----------------------------------------------------------
  const [responsible, setResponsible] = useState<Responsible | null>(null);
  const [respLoading, setRespLoading] = useState(false);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [respSaving, setRespSaving] = useState(false);
  const [respError, setRespError] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);

  // -- Beds ------------------------------------------------------------------
  const [beds, setBeds] = useState<BedItem[]>([]);
  const [bedsLoading, setBedsLoading] = useState(false);
  const [showDeletedBeds, setShowDeletedBeds] = useState(false);
  const [newBedNumber, setNewBedNumber] = useState('');
  const [bedSaving, setBedSaving] = useState(false);

  // -- Global error ----------------------------------------------------------
  const [globalError, setGlobalError] = useState<string | null>(null);

  // -- Fetch room ------------------------------------------------------------

  const fetchRoom = useCallback(async () => {
    setRoomLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) throw new Error();
      const data: RoomDetail = await res.json();
      setRoom(data);
    } catch {
      setGlobalError(t.common.error);
    } finally {
      setRoomLoading(false);
    }
  }, [roomId, t.common.error]);

  // -- Fetch inventory -------------------------------------------------------

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

  // -- Fetch logs ------------------------------------------------------------

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/inventory/logs`);
      if (!res.ok) throw new Error();
      const data: InventoryLog[] = await res.json();
      setLogs(data);
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, [roomId]);

  // -- Fetch responsible -----------------------------------------------------

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

  // -- Fetch staff list ------------------------------------------------------

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

  // -- Fetch beds ------------------------------------------------------------

  const fetchBeds = useCallback(async () => {
    setBedsLoading(true);
    try {
      const params = new URLSearchParams();
      if (isAdmin && showDeletedBeds) params.set('includeDeleted', 'true');
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/rooms/${roomId}/beds${qs}`);
      if (!res.ok) throw new Error();
      const data: BedItem[] = await res.json();
      setBeds(data);
    } catch {
      // silent
    } finally {
      setBedsLoading(false);
    }
  }, [roomId, isAdmin, showDeletedBeds]);

  // -- Initial load ----------------------------------------------------------

  useEffect(() => {
    fetchRoom();
    fetchInventory();
    fetchLogs();
    fetchResponsible();
    fetchBeds();
    if (isAdmin) fetchStaff();
  }, [fetchRoom, fetchInventory, fetchLogs, fetchResponsible, fetchBeds, fetchStaff, isAdmin]);

  // -- Inventory handlers ----------------------------------------------------

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
      fetchLogs();
    } catch (err) {
      setInvError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setInvSaving(false);
    }
  };

  const handleWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setWoSaving(true);
    setWoError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/inventory/${woItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'WRITE_OFF',
          writeOffQuantity: Number(woQuantity),
          comment: woComment || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? t.common.error);
      }
      setShowWriteOff(false);
      setWoItemId('');
      setWoQuantity('1');
      setWoComment('');
      fetchInventory();
      fetchLogs();
    } catch (err) {
      setWoError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setWoSaving(false);
    }
  };

  // -- Responsible handlers --------------------------------------------------

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

  // -- Bed handlers ----------------------------------------------------------

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    const bedNumber = newBedNumber.trim() || String(beds.filter(b => !b.deletedAt).length + 1);
    setBedSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedNumber }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        alert(data.error ?? t.common.error);
        return;
      }
      setNewBedNumber('');
      fetchBeds();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBedSaving(false);
    }
  };

  const handleDeleteBed = async (bedId: string) => {
    if (!confirm(t.rooms.deleteBedConfirm)) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/beds?bedId=${bedId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        alert(data.error ?? t.common.error);
        return;
      }
      fetchBeds();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.common.error);
    }
  };

  const handleRestoreBed = async (bedId: string) => {
    if (!confirm(t.rooms.restoreBedConfirm)) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/beds/${bedId}/restore`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        alert(data.error ?? t.common.error);
        return;
      }
      fetchBeds();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.common.error);
    }
  };

  // -- Derived ---------------------------------------------------------------

  const activeItems = inventory.filter(i => i.status === 'ACTIVE');
  const selectedItem = inventory.find(i => i.id === woItemId);

  // -- Render ----------------------------------------------------------------

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
    { key: 'inventory', label: t.rooms.inventory, icon: Package },
    { key: 'beds', label: t.rooms.bedsList, icon: BedDouble },
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
              {floorLabel(room.floor)} — {room.type}
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

      {/* -- TAB: Inventar ----------------------------------------------------- */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <section className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">{t.rooms.inventory}</h2>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {activeItems.length > 0 && !showAddInventory && (
                    <button
                      onClick={() => {
                        setWoItemId(activeItems[0].id);
                        setWoQuantity('1');
                        setWoComment('');
                        setWoError(null);
                        setShowWriteOff(true);
                      }}
                      className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50"
                    >
                      <Minus className="w-4 h-4" />
                      Hisobdan chiqarish
                    </button>
                  )}
                  {!showAddInventory && (
                    <button
                      onClick={() => setShowAddInventory(true)}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      {t.rooms.addInventory}
                    </button>
                  )}
                </div>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* -- Inventar tarixi ------------------------------------------------ */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800">Inventar tarixi</h2>
            </div>
            {logsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">Hali hech qanday amal bajarilmagan</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {logs.map((log) => (
                  <div key={log.id} className="px-6 py-3 flex items-start gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      log.action === 'ADDED' ? 'bg-green-500' : 'bg-orange-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          log.action === 'ADDED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {log.action === 'ADDED' ? 'Qo\'shildi' : 'Hisobdan chiqarildi'}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{log.inventoryItem.name}</span>
                        <span className="text-sm text-slate-500">— {log.quantity} dona</span>
                      </div>
                      {log.comment && (
                        <p className="text-xs text-slate-400 mt-0.5">{log.comment}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDateTime(log.createdAt)}
                        {log.performedBy && ` · ${log.performedBy.name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* -- TAB: To'shaklar --------------------------------------------------- */}
      {tab === 'beds' && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-slate-800">{t.rooms.bedsList}</h2>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeletedBeds((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                >
                  <History className="w-4 h-4" />
                  {showDeletedBeds ? t.rooms.hideDeletedBeds : t.rooms.showDeletedBeds}
                </button>
              </div>
            )}
          </div>

          {/* Add bed form (only for active rooms) */}
          {isAdmin && !room.deletedAt && (
            <form onSubmit={handleAddBed} className="px-6 py-4 bg-blue-50/30 border-b border-slate-100 flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium text-slate-700">{t.rooms.bedNumber}</label>
              <input
                type="text"
                value={newBedNumber}
                onChange={(e) => setNewBedNumber(e.target.value)}
                placeholder="1"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white w-32"
              />
              <button
                type="submit"
                disabled={bedSaving}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {bedSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t.rooms.addBed}
              </button>
            </form>
          )}

          {bedsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : beds.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              {showDeletedBeds ? t.rooms.noDeletedBeds : t.rooms.beds + ': 0'}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {beds.map((bed) => {
                const isDeleted = !!bed.deletedAt;
                return (
                  <div
                    key={bed.id}
                    className={`px-6 py-3 flex items-center gap-3 ${isDeleted ? 'bg-slate-50/50' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isDeleted
                        ? 'bg-slate-100 text-slate-400'
                        : bed.status === 'OCCUPIED'
                          ? 'bg-red-50 text-red-600'
                          : bed.status === 'MAINTENANCE'
                            ? 'bg-yellow-50 text-yellow-600'
                            : 'bg-green-50 text-green-600'
                    }`}>
                      <BedDouble className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800">
                          {t.rooms.bedNumber} {bed.bedNumber}
                        </span>
                        {!isDeleted && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            bed.status === 'OCCUPIED'
                              ? 'bg-red-100 text-red-800'
                              : bed.status === 'MAINTENANCE'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {bed.status === 'OCCUPIED'
                              ? t.rooms.occupied
                              : bed.status === 'MAINTENANCE'
                                ? t.rooms.maintenance
                                : t.rooms.available}
                          </span>
                        )}
                        {isDeleted && (
                          <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {t.rooms.deletedLabel}
                          </span>
                        )}
                      </div>
                      {isDeleted && bed.deletedAt && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t.rooms.deletedAt}: {formatDateTime(bed.deletedAt)}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        {isDeleted ? (
                          <button
                            onClick={() => handleRestoreBed(bed.id)}
                            disabled={!!room.deletedAt}
                            title={room.deletedAt ? t.rooms.restoreRoomConfirm : t.rooms.restore}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t.rooms.restore}
                          </button>
                        ) : (
                          bed.status === 'AVAILABLE' && (
                            <button
                              onClick={() => handleDeleteBed(bed.id)}
                              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {t.common.delete}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* -- TAB: Javobgar ----------------------------------------------------- */}
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

      {/* -- Hisobdan chiqarish modali ------------------------------------------ */}
      {showWriteOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Hisobdan chiqarish</h2>
              <button onClick={() => { setShowWriteOff(false); setWoError(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleWriteOff} className="p-6 space-y-4">
              {woError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {woError}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Jihoz *</label>
                <select
                  value={woItemId}
                  onChange={(e) => { setWoItemId(e.target.value); setWoQuantity('1'); }}
                  required
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  {activeItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (mavjud: {item.quantity} dona)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Miqdor * {selectedItem && <span className="text-slate-400 font-normal">(max: {selectedItem.quantity})</span>}
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedItem?.quantity ?? 9999}
                  value={woQuantity}
                  onChange={(e) => setWoQuantity(e.target.value)}
                  required
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Sabab / Izoh</label>
                <input
                  type="text"
                  value={woComment}
                  onChange={(e) => setWoComment(e.target.value)}
                  placeholder="Masalan: Eskirgan, singan..."
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowWriteOff(false); setWoError(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={woSaving} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {woSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
                  Hisobdan chiqarish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
