'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, LogIn, LogOut, Users, Building2, Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface Room { id: string; floor: number; roomNumber: string; type: string; }
interface StaffUser { id: string; name: string; role: string; }
interface AttendanceRecord {
  id: string;
  userId: string;
  roomId: string | null;
  checkIn: string;
  checkOut: string | null;
  user: StaffUser;
  room: Room | null;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', HEAD_DOCTOR: 'Bosh shifokor', DOCTOR: 'Shifokor',
  HEAD_NURSE: 'Bosh hamshira', NURSE: 'Hamshira', HEAD_LAB_TECH: 'Bosh laborant',
  LAB_TECH: 'Laborant', RECEPTIONIST: 'Qabulxona', SPEECH_THERAPIST: 'Logoped',
  MASSAGE_THERAPIST: 'Massajchi', SANITARY_WORKER: 'Sanitar',
};

function fmt(d: string) {
  return new Date(d).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' });
}
function duration(checkIn: string, checkOut: string | null) {
  const end = checkOut ? new Date(checkOut) : new Date();
  const mins = Math.floor((end.getTime() - new Date(checkIn).getTime()) / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}s ${m}d` : `${m}d`;
}

export default function AttendancePage() {
  // /attendance uchun action mapping yo'q — page-level access kifoya.
  // can() kerak bo'lsa kelajakda action qo'shilganda foydalaniladi.
  const { can } = usePermissions();
  void can;

  const [date, setDate] = useState(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Check-in modal
  const [showModal, setShowModal] = useState(false);
  const [selUser, setSelUser] = useState('');
  const [selRoom, setSelRoom] = useState('');

  const dateStr = date.toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const [attRes, roomRes] = await Promise.all([
      fetch(`/api/attendance?date=${dateStr}`),
      fetch('/api/rooms'),
    ]);
    if (attRes.ok) { const d = await attRes.json(); setRecords(d.records); setStaff(d.staff); }
    if (roomRes.ok) { const d = await roomRes.json(); setRooms(d.data ?? d); }
    setLoading(false);
  }, [dateStr]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh har 60 sekund
  useEffect(() => {
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  const checkedInIds = new Set(records.map(r => r.userId));

  // Tanlangan xodim rolini aniqlash
  const selectedStaff = staff.find(s => s.id === selUser);
  const selectedRole = selectedStaff?.role ?? '';

  // Rolga qarab xonalarni filterlash
  const filteredRooms = (() => {
    if (selectedRole === 'DOCTOR' || selectedRole === 'HEAD_DOCTOR') {
      return rooms.filter(r => r.floor === 2 && ['101', '102', '103'].includes(r.roomNumber));
    }
    return rooms;
  })();

  // Xodim tanlaganda rolga qarab xonani avtomatik tanlash
  useEffect(() => {
    if (!selUser) { setSelRoom(''); return; }
    const user = staff.find(s => s.id === selUser);
    if (!user) return;
    if (user.role === 'RECEPTIONIST') {
      // 2-qavatdagi qabulxona xonasini avtomatik tanlash
      const receptionRoom = rooms.find(r =>
        r.floor === 2 && r.type.toLowerCase().includes('reception')
      ) ?? rooms.find(r => r.floor === 2);
      if (receptionRoom) setSelRoom(receptionRoom.id);
    } else if (user.role === 'DOCTOR' || user.role === 'HEAD_DOCTOR') {
      // 101-103 xonalari filterlanganda avvalgi tanlov reset
      setSelRoom('');
    }
  }, [selUser, staff, rooms]);

  const checkIn = async () => {
    if (!selUser) return;
    setBusy('in');
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selUser, roomId: selRoom || undefined }),
    });
    setBusy(null);
    if (res.ok) { setShowModal(false); setSelUser(''); setSelRoom(''); load(); }
    else { const e = await res.json(); alert(e.error); }
  };

  const checkOut = async (rec: AttendanceRecord) => {
    setBusy(rec.id);
    await fetch(`/api/attendance/${rec.id}`, { method: 'PATCH' });
    setBusy(null);
    load();
  };

  const deleteRec = async (id: string) => {
    if (!confirm('Yozuvni o\'chirish?')) return;
    setBusy(id + 'd');
    await fetch(`/api/attendance/${id}`, { method: 'DELETE' });
    setBusy(null);
    load();
  };

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d); };
  const isToday = dateStr === new Date().toISOString().slice(0, 10);

  const present = records.filter(r => !r.checkOut).length;
  const gone = records.filter(r => r.checkOut).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" /> Davomat
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Xodimlar kelish-ketish vaqti</p>
        </div>
        {isToday && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <LogIn className="w-4 h-4" /> Keldi belgilash
          </button>
        )}
      </div>

      {/* Sana navigatsiya */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={prevDay} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-slate-800">{fmtDate(date)}</p>
          {isToday && <p className="text-xs text-blue-600 font-medium">Bugun</p>}
        </div>
        <button onClick={nextDay} disabled={isToday} className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Jami keldi', value: records.length, color: 'blue' },
          { label: 'Hozir xizmtda', value: present, color: 'green' },
          { label: 'Ketdi', value: gone, color: 'slate' },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</p>
            <p className={`text-xs text-${s.color}-600 mt-1`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Yozuvlar */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Davomat ro&apos;yxati</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {isToday ? 'Bugun hech kim belgilanmagan' : 'Bu kun uchun yozuv yo\'q'}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {records.map(rec => (
              <div key={rec.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${rec.checkOut ? 'bg-slate-300' : 'bg-green-500 animate-pulse'}`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-800 text-sm">{rec.user.name}</p>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {ROLE_LABELS[rec.user.role] ?? rec.user.role}
                      </span>
                      {!rec.checkOut && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          Xizmtda
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {rec.room && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {rec.room.floor}-qavat, {rec.room.roomNumber}-xona ({rec.room.type})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vaqt */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Keldi</p>
                    <p className="text-sm font-semibold text-green-700">{fmt(rec.checkIn)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Ketdi</p>
                    <p className={`text-sm font-semibold ${rec.checkOut ? 'text-slate-700' : 'text-slate-300'}`}>
                      {rec.checkOut ? fmt(rec.checkOut) : '—'}
                    </p>
                  </div>
                  <div className="text-center min-w-[48px]">
                    <p className="text-xs text-slate-400">Davomiyligi</p>
                    <p className="text-sm font-semibold text-blue-600">{duration(rec.checkIn, rec.checkOut)}</p>
                  </div>

                  {/* Amallar */}
                  <div className="flex items-center gap-2">
                    {!rec.checkOut && isToday && (
                      <button
                        onClick={() => checkOut(rec)}
                        disabled={busy === rec.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {busy === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                        Ketdi
                      </button>
                    )}
                    <button
                      onClick={() => deleteRec(rec.id)}
                      disabled={busy === rec.id + 'd'}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bugun hali kelmaganlar */}
      {isToday && staff.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-semibold text-slate-700 text-sm">Hali belgilanmaganlar</p>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {staff.filter(s => !checkedInIds.has(s.id)).map(s => (
              <button
                key={s.id}
                onClick={() => { setSelUser(s.id); setShowModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-colors"
              >
                <LogIn className="w-3 h-3" /> {s.name}
              </button>
            ))}
            {staff.filter(s => !checkedInIds.has(s.id)).length === 0 && (
              <p className="text-sm text-slate-400 py-2">Barcha xodimlar belgilangan</p>
            )}
          </div>
        </div>
      )}

      {/* Check-in modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Keldi belgilash</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Xodim <span className="text-red-500">*</span></label>
                <select
                  value={selUser}
                  onChange={e => setSelUser(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tanlang...</option>
                  {staff.filter(s => !checkedInIds.has(s.id)).map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {ROLE_LABELS[s.role] ?? s.role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Xona (ixtiyoriy)</label>
                <select
                  value={selRoom}
                  onChange={e => setSelRoom(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Xona tanlanmagan</option>
                  {filteredRooms.map(r => (
                    <option key={r.id} value={r.id}>{r.floor}-qavat, {r.roomNumber}-xona ({r.type})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowModal(false); setSelUser(''); setSelRoom(''); }}
                className="flex-1 px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Bekor
              </button>
              <button
                onClick={checkIn}
                disabled={!selUser || busy === 'in'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {busy === 'in' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Keldi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
