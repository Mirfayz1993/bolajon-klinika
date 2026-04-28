'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Plus, X, Save, Receipt, Building2 } from 'lucide-react';

interface Room { id: string; roomNumber: string; floor: number; }
interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  roomId: string | null;
  room: { roomNumber: string; floor: number } | null;
}

const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: 'INVENTORY', label: 'Inventar', color: 'bg-blue-100 text-blue-700' },
  { value: 'MEDICINE', label: 'Dori-darmon', color: 'bg-green-100 text-green-700' },
  { value: 'UTILITY', label: 'Kommunal', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'REAGENT', label: 'Reaktivlar', color: 'bg-purple-100 text-purple-700' },
  { value: 'SALARY', label: 'Maosh', color: 'bg-orange-100 text-orange-700' },
  { value: 'OTHER', label: 'Boshqa', color: 'bg-slate-100 text-slate-700' },
];

function catLabel(val: string) {
  return CATEGORIES.find((c) => c.value === val)?.label ?? val;
}
function catColor(val: string) {
  return CATEGORIES.find((c) => c.value === val)?.color ?? 'bg-slate-100 text-slate-700';
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('uz-UZ');
}
function fmtMoney(n: number) {
  return n.toLocaleString('uz-UZ') + " so'm";
}

export default function ExpensesPage() {
  const { can } = usePermissions();
  const canCreateExpense = can('/expenses:create');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Filters
  const [filterRoom, setFilterRoom] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'OTHER',
    amount: '',
    description: '',
    roomId: '',
    date: new Date().toISOString().split('T')[0],
  });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterRoom) params.set('roomId', filterRoom);
    if (filterCat) params.set('category', filterCat);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    try {
      const res = await fetch('/api/expenses?' + params.toString());
      if (res.ok) {
        const d = await res.json();
        setExpenses(d.expenses ?? []);
        setTotal(d.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filterRoom, filterCat, filterFrom, filterTo]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  useEffect(() => {
    fetch('/api/rooms').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : (d.rooms ?? d.data ?? []);
      setRooms(list);
    }).catch(() => {});
  }, []);

  async function handleSave() {
    if (!form.amount || !form.description) return;
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ category: 'OTHER', amount: '', description: '', roomId: '', date: new Date().toISOString().split('T')[0] });
        fetchExpenses();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Receipt size={20} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Xarajatlar</h1>
            <p className="text-sm text-slate-500">Klinika xarajatlarini boshqarish</p>
          </div>
        </div>
        {canCreateExpense && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> Xarajat qo&apos;shish
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
        >
          <option value="">Barcha kategoriyalar</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={filterRoom}
          onChange={e => setFilterRoom(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
        >
          <option value="">Barcha xonalar</option>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>{r.floor}-qavat, {r.roomNumber}-xona</option>
          ))}
        </select>
        <input
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Dan"
        />
        <input
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Gacha"
        />
        {(filterCat || filterRoom || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterCat(''); setFilterRoom(''); setFilterFrom(''); setFilterTo(''); }}
            className="text-sm text-slate-500 hover:text-red-500 px-3 py-2 border border-slate-200 rounded-lg"
          >
            Tozalash
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {CATEGORIES.map(cat => {
          const catTotal = expenses.filter(e => e.category === cat.value).reduce((s, e) => s + Number(e.amount), 0);
          if (catTotal === 0) return null;
          return (
            <div key={cat.value} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
              <p className="text-lg font-bold text-slate-800 mt-2">{fmtMoney(catTotal)}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">{expenses.length} ta xarajat</p>
          <p className="text-sm font-bold text-red-600">Jami: {fmtMoney(total)}</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Xarajatlar yo&apos;q</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sana</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tavsif</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kategoriya</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Xona</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Miqdor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expenses.map((e, i) => (
                <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                  <td className="px-5 py-3 text-slate-600">{fmtDate(e.date)}</td>
                  <td className="px-5 py-3 text-slate-800 font-medium">{e.description}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColor(e.category)}`}>
                      {catLabel(e.category)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {e.room ? (
                      <span className="flex items-center gap-1">
                        <Building2 size={12} />
                        {e.room.floor}-qavat, {e.room.roomNumber}-xona
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-red-600">{fmtMoney(Number(e.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Xarajat qo&apos;shish</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Kategoriya *</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Tavsif *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Xarajat tavsifi..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Miqdor (so&apos;m) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Xona (ixtiyoriy)</label>
                <select
                  value={form.roomId}
                  onChange={e => setForm(p => ({ ...p, roomId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                >
                  <option value="">— Xona tanlang —</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.floor}-qavat, {r.roomNumber}-xona</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Sana</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Bekor
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.amount || !form.description}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                <Save size={14} /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
