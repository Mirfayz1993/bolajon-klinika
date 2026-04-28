'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  BedDouble,
  Building2,
  Pencil,
  Trash2,
  Info,
  RotateCcw,
} from 'lucide-react';
import { floorLabel } from '@/lib/utils';

// --- Types --------------------------------------------------------------------

interface BedPatient {
  id: string;
  firstName: string;
  lastName: string;
}

interface BedAdmission {
  id: string;
  patient: BedPatient;
}

interface Bed {
  id: string;
  roomId: string;
  bedNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  admissions: BedAdmission[];
}

interface Room {
  id: string;
  floor: number;
  roomNumber: string;
  type: string;
  capacity: number;
  isActive: boolean;
  isAmbulatory: boolean;
  beds: Bed[];
  deletedAt?: string | null;
  _count?: { beds: number };
}

interface RoomForm {
  floor: string;
  roomNumber: string;
  type: string;
  capacity: string;
  isActive: boolean;
}

// --- Constants ----------------------------------------------------------------

const emptyRoomForm: RoomForm = {
  floor: '1',
  roomNumber: '',
  type: '',
  capacity: '4',
  isActive: true,
};

const FLOORS = [1, 2, 3, 4];

// --- Bed card indicator -------------------------------------------------------

function BedCard({
  bed,
  isAmbulatory,
  onOccupiedClick,
}: {
  bed: Bed;
  isAmbulatory: boolean;
  onOccupiedClick: (patientId: string, ambulatory: boolean) => void;
}) {
  const { t } = useLanguage();
  const patient = bed.admissions?.[0]?.patient;

  // Aktiv admission mavjud bo'lsa — har qanday bed.status bo'lsa ham band deb ko'rsat
  if (patient) {
    return (
      <button
        onClick={() => onOccupiedClick(patient.id, isAmbulatory)}
        className="flex flex-col items-center gap-0.5 p-2 bg-red-50 border border-red-200 rounded-lg min-w-[68px] hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
        title={`${patient.firstName} ${patient.lastName} — profilga o'tish`}
      >
        <BedDouble className="w-4 h-4 text-red-600" />
        <span className="text-xs font-semibold text-red-700">{bed.bedNumber}</span>
        <span className="text-[10px] font-medium text-red-600 leading-tight max-w-[64px] truncate text-center">
          {patient.firstName} {patient.lastName}
        </span>
      </button>
    );
  }

  if (bed.status === 'MAINTENANCE') {
    return (
      <div className="flex flex-col items-center gap-0.5 p-2 bg-yellow-50 border border-yellow-200 rounded-lg min-w-[68px]">
        <BedDouble className="w-4 h-4 text-yellow-600" />
        <span className="text-xs font-semibold text-yellow-700">{bed.bedNumber}</span>
        <span className="text-[10px] font-medium text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
          {t.rooms.maintenance}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5 p-2 bg-green-50 border border-green-200 rounded-lg min-w-[68px]">
      <BedDouble className="w-4 h-4 text-green-600" />
      <span className="text-xs font-semibold text-green-700">{bed.bedNumber}</span>
      <span className="text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
        {t.rooms.available}
      </span>
    </div>
  );
}

// --- Main Component -----------------------------------------------------------

export default function RoomsPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const { can } = usePermissions();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'ADMIN';
  const canCreateRoom = can('/rooms:create');
  const canEditRoom = can('/rooms:edit');
  const canDeleteRoom = can('/rooms:delete');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomTypes, setRoomTypes] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/room-types')
      .then((r) => r.json())
      .then((data: { name: string }[]) => {
        const names = data.map((rt) => rt.name);
        setRoomTypes(names);
        setRoomForm((prev) => ({ ...prev, type: prev.type || names[0] || '' }));
      })
      .catch(() => {});
  }, []);

  const [floorFilter, setFloorFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'deleted'>('active');

  // Add / Edit modal
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoomForm);
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomFormError, setRoomFormError] = useState<string | null>(null);

  // --- Fetch rooms -----------------------------------------------------------

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ include: 'beds' });
      if (floorFilter !== null) params.set('floor', String(floorFilter));
      if (typeFilter !== null) params.set('type', typeFilter);
      if (isAdmin && viewMode === 'deleted') params.set('onlyDeleted', 'true');
      const res = await fetch(`/api/rooms?${params.toString()}`);
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setRooms(Array.isArray(json) ? json : (json.data ?? []));
    } catch {
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  }, [floorFilter, typeFilter, viewMode, isAdmin, t.common.error]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // --- Add / Edit room handlers ----------------------------------------------

  const openAddRoomModal = () => {
    setEditingRoom(null);
    setRoomForm(emptyRoomForm);
    setRoomFormError(null);
    setShowRoomModal(true);
  };

  const openEditRoomModal = (room: Room, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRoom(room);
    setRoomForm({
      floor: String(room.floor),
      roomNumber: room.roomNumber,
      type: room.type,
      capacity: String(room.capacity),
      isActive: room.isActive,
    });
    setRoomFormError(null);
    setShowRoomModal(true);
  };

  const handleRoomFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setRoomForm((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setRoomForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomSaving(true);
    setRoomFormError(null);
    try {
      const payload = {
        floor: parseInt(roomForm.floor, 10),
        roomNumber: roomForm.roomNumber,
        type: roomForm.type,
        capacity: parseInt(roomForm.capacity, 10),
        isActive: roomForm.isActive,
      };
      const url = editingRoom ? `/api/rooms/${editingRoom.id}` : '/api/rooms';
      const method = editingRoom ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? t.common.error);
      }
      setShowRoomModal(false);
      fetchRooms();
    } catch (err) {
      setRoomFormError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setRoomSaving(false);
    }
  };

  const handleDeleteRoom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t.rooms.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        alert(data.error ?? t.common.error);
        return;
      }
      fetchRooms();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.common.error);
    }
  };

  const handleRestoreRoom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t.rooms.restoreRoomConfirm)) return;
    try {
      const res = await fetch(`/api/rooms/${id}/restore`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        alert(data.error ?? t.common.error);
        return;
      }
      fetchRooms();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.common.error);
    }
  };

  // --- Helpers ---------------------------------------------------------------

  const countByStatus = (beds: Bed[], status: Bed['status']) =>
    beds.filter((b) => b.status === status).length;

  const handleBedClick = (patientId: string, ambulatory: boolean) => {
    if (ambulatory) {
      router.push(`/patients/${patientId}?tab=nurse&noteType=AMBULATORY`);
    } else {
      router.push(`/patients/${patientId}?tab=nurse`);
    }
  };

  // --- Render ----------------------------------------------------------------

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t.rooms.title}</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('active')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'active'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.rooms.activeRooms}
              </button>
              <button
                onClick={() => setViewMode('deleted')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'deleted'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.rooms.deletedRooms}
              </button>
            </div>
          )}
          {canCreateRoom && viewMode === 'active' && (
            <button
              onClick={openAddRoomModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t.rooms.addRoom}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Floor filter */}
        <button
          onClick={() => setFloorFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            floorFilter === null
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {t.rooms.allFloors}
        </button>
        {FLOORS.map((f) => (
          <button
            key={f}
            onClick={() => setFloorFilter(floorFilter === f ? null : f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              floorFilter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {floorLabel(f)}
          </button>
        ))}

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* Type filter */}
        {roomTypes.map((rt) => (
          <button
            key={rt}
            onClick={() => setTypeFilter(typeFilter === rt ? null : rt)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === rt
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {rt}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{viewMode === 'deleted' ? t.rooms.noDeletedRooms : t.rooms.noRooms}</p>
        </div>
      ) : (
        /* Grid — 3 ustun */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const availCount = countByStatus(room.beds, 'AVAILABLE');
            const occupiedCount = countByStatus(room.beds, 'OCCUPIED');
            const totalBeds = room.beds.length;
            const occupiedPct = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0;

            return (
              <div
                key={room.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm">
                        {t.rooms.number} {room.roomNumber}
                      </h3>
                      <span className="text-xs text-slate-500">
                        {floorLabel(room.floor)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-medium bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      {room.type}
                    </span>
                    {!room.isActive && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {t.staff.inactive}
                      </span>
                    )}
                    {room.deletedAt && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {t.rooms.deletedLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Beds summary stats */}
                {totalBeds > 0 && (
                  <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      {availCount} {t.rooms.available}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      {occupiedCount} {t.rooms.occupied}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-slate-400">
                      <BedDouble className="w-3 h-3" />
                      {totalBeds} {t.rooms.bedsCount}
                    </span>
                  </div>
                )}

                {/* Bed cards */}
                {totalBeds > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {room.beds.map((bed) => (
                      <BedCard
                        key={bed.id}
                        bed={bed}
                        isAmbulatory={room.isAmbulatory}
                        onOccupiedClick={handleBedClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4 mb-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <span className="text-xs text-slate-400">{t.rooms.beds}: 0</span>
                  </div>
                )}

                {/* Actions — permission gated */}
                {viewMode === 'deleted' && (canEditRoom || canCreateRoom) && (
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100 flex-wrap">
                    <button
                      onClick={() => router.push(`/rooms/${room.id}`)}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      {t.rooms.details}
                    </button>
                    {canEditRoom && (
                      <button
                        onClick={(e) => handleRestoreRoom(room.id, e)}
                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t.rooms.restore}
                      </button>
                    )}
                  </div>
                )}
                {viewMode === 'active' && (canEditRoom || canDeleteRoom) && (
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100 flex-wrap">
                    <button
                      onClick={() => router.push(`/rooms/${room.id}`)}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      {t.rooms.details}
                    </button>
                    {canEditRoom && (
                      <button
                        onClick={(e) => openEditRoomModal(room, e)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t.common.edit}
                      </button>
                    )}
                    {/* Krovat qo'shish */}
                    {canEditRoom && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const nextNum = String(room.beds.length + 1);
                          try {
                            const res = await fetch(`/api/rooms/${room.id}/beds`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ bedNumber: nextNum }),
                            });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({})) as { error?: string };
                              alert(data.error ?? t.common.error);
                              return;
                            }
                            fetchRooms();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : t.common.error);
                          }
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1.5 rounded-lg transition-colors"
                        title={t.rooms.addBed}
                      >
                        <Plus className="w-3.5 h-3.5" /> {t.rooms.addBedShort}
                      </button>
                    )}
                    {/* Oxirgi bo'sh krovatni o'chirish */}
                    {canEditRoom && room.beds.some(b => b.status === 'AVAILABLE' && b.admissions.length === 0) && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(t.rooms.deleteLastEmptyBedConfirm)) return;
                          try {
                            const res = await fetch(`/api/rooms/${room.id}/beds`, { method: 'DELETE' });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({})) as { error?: string };
                              alert(data.error ?? t.common.error);
                              return;
                            }
                            fetchRooms();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : t.common.error);
                          }
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-700 hover:bg-orange-50 px-2 py-1.5 rounded-lg transition-colors"
                        title={t.rooms.deleteEmptyBed}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t.rooms.addBedShort}
                      </button>
                    )}
                    {canDeleteRoom && (
                      <button
                        onClick={(e) => handleDeleteRoom(room.id, e)}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t.common.delete}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* -- Add / Edit Room Modal -------------------------------------------- */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingRoom ? t.rooms.editRoom : t.rooms.addRoom}
              </h2>
              <button
                onClick={() => setShowRoomModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRoomSubmit} className="p-6">
              {roomFormError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {roomFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Floor */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.rooms.floor} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="floor"
                    value={roomForm.floor}
                    onChange={handleRoomFormChange}
                    required
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {FLOORS.map((f) => (
                      <option key={f} value={f}>
                        {floorLabel(f)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.rooms.number} <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="roomNumber"
                    value={roomForm.roomNumber}
                    onChange={handleRoomFormChange}
                    required
                    placeholder="101"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Type */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    {t.rooms.type} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={roomForm.type}
                    onChange={handleRoomFormChange}
                    required
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Capacity */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.rooms.capacity} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    value={roomForm.capacity}
                    onChange={handleRoomFormChange}
                    required
                    min={1}
                    max={20}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* isActive */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">{t.rooms.isActive}</label>
                  <div className="flex items-center h-[38px]">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={roomForm.isActive}
                      onChange={handleRoomFormChange}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <span className="ml-2 text-sm text-slate-600">
                      {roomForm.isActive ? t.staff.active : t.staff.inactive}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRoomModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={roomSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {roomSaving && <Loader2 className="w-4 h-4 animate-spin" />}
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
