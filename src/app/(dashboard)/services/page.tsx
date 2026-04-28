'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Tag,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  Calculator,
  ListChecks,
  Settings2,
  FlaskConical,
} from 'lucide-react';

// --- Types --------------------------------------------------------------------

interface ServiceItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  duration: number | null;
  isActive: boolean;
}

interface ServiceCategory {
  id: string;
  name: string;
  isActive: boolean;
  items: ServiceItem[];
}

interface LabTestType {
  id: string;
  name: string;
  price: number;
  normalRange?: string;
  unit?: string;
  group?: string;
}

// Agar kategoriya nomi "lab" yoki "laboratoriya" so'zini o'z ichiga olsa
// → LabTestType dan ma'lumot oladi
const LAB_KEYWORDS = ['lab', 'laboratoriya', 'labaratoriya', 'tahlil'];
function isLabLinked(name: string) {
  const lower = name.toLowerCase();
  return LAB_KEYWORDS.some((k) => lower.includes(k));
}

// --- Helpers ------------------------------------------------------------------

function fmt(n: number) {
  return n.toLocaleString('uz-UZ') + ' so\'m';
}

// --- Simple Select Dropdown ---------------------------------------------------

function Dropdown({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

// --- Confirm Modal ------------------------------------------------------------

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <p className="text-slate-700 font-medium">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Bekor qilish
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
          >
            O&apos;chirish
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main ---------------------------------------------------------------------

export default function ServicesPage() {
  const { isAdmin } = usePermissions();

  const [tab, setTab] = useState<'calculator' | 'manage'>('calculator');

  // -- Confirm dialog -----------------------------------------------------------
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  function showConfirm(message: string, onConfirm: () => void) {
    setConfirmState({ message, onConfirm });
  }

  // -- Data --------------------------------------------------------------------
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/service-categories');
      if (!res.ok) throw new Error();
      setCategories(await res.json());
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // -- Lab test types (loaded when lab category selected) -----------------------
  const [labTestTypes, setLabTestTypes] = useState<LabTestType[]>([]);
  const [labLoading, setLabLoading] = useState(false);

  // -- Calculator state ---------------------------------------------------------
  const [selCategoryId, setSelCategoryId] = useState('');
  const [selectedItems, setSelectedItems] = useState<ServiceItem[]>([]);

  const selCategory = categories.find((c) => c.id === selCategoryId);
  const selIsLab = selCategory ? isLabLinked(selCategory.name) : false;
  const total = selectedItems.reduce((s, i) => s + Number(i.price), 0);

  // Lab test types ni yuklash
  useEffect(() => {
    if (!selIsLab) { setLabTestTypes([]); return; }
    setLabLoading(true);
    fetch('/api/lab-test-types')
      .then((r) => r.json())
      .then((d) => setLabTestTypes(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setLabTestTypes([]))
      .finally(() => setLabLoading(false));
  }, [selIsLab]);

  // Lab test types → ServiceItem formatiga o'girish
  const labAsItems: ServiceItem[] = labTestTypes.map((lt) => ({
    id: lt.id,
    categoryId: selCategoryId,
    name: lt.name,
    price: lt.price,
    duration: null,
    isActive: true,
  }));

  // Hozirgi ko'rsatiladigan items ro'yxati
  const visibleItems = selIsLab ? labAsItems : (selCategory?.items ?? []);

  function toggleItem(item: ServiceItem) {
    setSelectedItems((prev) =>
      prev.find((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  }

  function clearSelection() {
    setSelectedItems([]);
    setSelCategoryId('');
  }

  // -- Manage state -------------------------------------------------------------

  // Category form
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // Item form
  const [selCatForItem, setSelCatForItem] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDuration, setNewItemDuration] = useState('');
  const [itemSaving, setItemSaving] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');

  // -- Category CRUD ---------------------------------------------------------

  async function addCategory() {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    try {
      const res = await fetch('/api/service-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? 'Xatolik');
        return;
      }
      setNewCatName('');
      await loadCategories();
    } finally {
      setCatSaving(false);
    }
  }

  async function saveEditCat(id: string) {
    if (!editCatName.trim()) return;
    try {
      await fetch(`/api/service-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCatName.trim() }),
      });
      setEditCatId(null);
      await loadCategories();
    } catch { /* ignore */ }
  }

  function deleteCategory(id: string) {
    showConfirm("Bo'limni o'chirasizmi?", async () => {
      setConfirmState(null);
      await fetch(`/api/service-categories/${id}`, { method: 'DELETE' });
      await loadCategories();
    });
  }

  // -- Item CRUD ------------------------------------------------------------

  async function addItem() {
    if (!selCatForItem || !newItemName.trim() || !newItemPrice) return;
    setItemSaving(true);
    try {
      const res = await fetch('/api/service-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selCatForItem,
          name: newItemName.trim(),
          price: Number(newItemPrice),
          duration: newItemDuration ? Number(newItemDuration) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? 'Xatolik');
        return;
      }
      setNewItemName('');
      setNewItemPrice('');
      setNewItemDuration('');
      await loadCategories();
    } finally {
      setItemSaving(false);
    }
  }

  async function saveEditItem(id: string) {
    if (!editItemName.trim() || !editItemPrice) return;
    await fetch(`/api/service-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editItemName.trim(), price: Number(editItemPrice) }),
    });
    setEditItemId(null);
    await loadCategories();
  }

  function deleteItem(id: string) {
    showConfirm("Xizmatni o'chirasizmi?", async () => {
      setConfirmState(null);
      await fetch(`/api/service-items/${id}`, { method: 'DELETE' });
      await loadCategories();
    });
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="p-6 flex flex-col gap-6 h-full">
      {/* Confirm Modal */}
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Tag size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Xizmatlar</h1>
            <p className="text-sm text-slate-500 mt-0.5">Xizmat turlari va narxlari</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTab('calculator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'calculator' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calculator size={15} />
              Narx hisoblash
            </button>
            <button
              type="button"
              onClick={() => setTab('manage')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'manage' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Settings2 size={15} />
              Boshqarish
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : tab === 'calculator' ? (
        /* ---------------- CALCULATOR TAB ---------------- */
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Left: selectors */}
          <div className="w-96 flex-shrink-0 flex flex-col gap-4">
            {/* Dropdown 1: Category */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <Dropdown
                label="1. Bo'lim tanlang"
                value={selCategoryId}
                options={categories}
                onChange={(id) => { setSelCategoryId(id); }}
                placeholder="— Bo'limni tanlang —"
              />
            </div>

            {/* Dropdown 2: Items (multi-select as cards) */}
            {selCategory && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {selIsLab && <FlaskConical size={14} className="text-blue-500" />}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    2. {selIsLab ? 'Tahlil turini tanlang' : 'Xizmatlarni tanlang'}
                  </p>
                </div>
                {labLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                ) : visibleItems.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Bu bo&apos;limda xizmat yo&apos;q</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
                    {visibleItems.map((item) => {
                      const isSelected = !!selectedItems.find((i) => i.id === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItem(item)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-blue-600' : 'border-2 border-slate-300'
                              }`}
                            >
                              {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                {item.name}
                              </p>
                              {item.duration && (
                                <p className="text-xs text-slate-400">{item.duration} daqiqa</p>
                              )}
                            </div>
                          </div>
                          <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                            {fmt(item.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: summary */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks size={18} className="text-slate-500" />
                  <h2 className="font-semibold text-slate-700">Tanlangan xizmatlar</h2>
                </div>
                {selectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <X size={12} />
                    Tozalash
                  </button>
                )}
              </div>

              {selectedItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Calculator size={28} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 text-sm">Xizmat tanlanmagan</p>
                    <p className="text-slate-400 text-xs mt-1">Chapdan bo&apos;lim va xizmat tanlang</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 flex-1">
                    {selectedItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-700">{item.name}</p>
                            <p className="text-xs text-slate-400">
                              {categories.find((c) => c.id === item.categoryId)?.name}
                              {item.duration ? ` · ${item.duration} daqiqa` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-700">{fmt(item.price)}</span>
                          <button
                            type="button"
                            onClick={() => toggleItem(item)}
                            className="text-slate-300 hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="mt-auto border-t-2 border-slate-200 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">
                        Jami ({selectedItems.length} ta xizmat)
                      </span>
                      <span className="text-2xl font-bold text-blue-700">{fmt(total)}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Bemorga aytilishi kerak bo&apos;lgan to&apos;lov miqdori
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ---------------- MANAGE TAB ---------------- */
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Left: Categories */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
              <h2 className="font-semibold text-slate-700 text-sm">Bo&apos;limlar</h2>

              {/* Add category */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                  placeholder="Yangi bo'lim nomi..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  disabled={catSaving || !newCatName.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* List */}
              <div className="flex flex-col gap-1 max-h-[calc(100vh-380px)] overflow-y-auto">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => setSelCatForItem(cat.id)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      selCatForItem === cat.id
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {editCatId === cat.id ? (
                      <div className="flex gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEditCat(cat.id)}
                          autoFocus
                          className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none"
                        />
                        <button onClick={() => saveEditCat(cat.id)} className="text-green-600 hover:text-green-700">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditCatId(null)} className="text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{cat.name}</p>
                          <p className="text-xs text-slate-400">{cat.items.length} ta xizmat</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditCatId(cat.id);
                              setEditCatName(cat.name);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-4">Bo&apos;lim yo&apos;q</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Items */}
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 flex-1 min-h-0">
              {!selCatForItem ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Tag size={28} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 text-sm">Bo&apos;lim tanlang</p>
                    <p className="text-slate-400 text-xs mt-1">Chapdan bo&apos;limni bosing</p>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-semibold text-slate-700 text-sm">
                    {categories.find((c) => c.id === selCatForItem)?.name} — xizmatlar
                  </h2>

                  {/* Add item */}
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Xizmat nomi..."
                      className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="number"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="Narxi (so'm)..."
                      className="w-44 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="number"
                      value={newItemDuration}
                      onChange={(e) => setNewItemDuration(e.target.value)}
                      placeholder="Vaqt (daqiqa)"
                      className="w-36 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={itemSaving || !newItemName.trim() || !newItemPrice}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Plus size={15} />
                      Qo&apos;shish
                    </button>
                  </div>

                  {/* Items table */}
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Xizmat nomi</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Narxi</th>
                          <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vaqt</th>
                          <th className="w-20" />
                        </tr>
                      </thead>
                      <tbody>
                        {(categories.find((c) => c.id === selCatForItem)?.items ?? []).map((item) => (
                          <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            {editItemId === item.id ? (
                              <>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={editItemName}
                                    onChange={(e) => setEditItemName(e.target.value)}
                                    autoFocus
                                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    value={editItemPrice}
                                    onChange={(e) => setEditItemPrice(e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none text-right"
                                  />
                                </td>
                                <td className="py-2 px-3 text-center text-slate-400 text-xs">
                                  {item.duration ? `${item.duration} min` : '—'}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={() => saveEditItem(item.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                                      <Check size={14} />
                                    </button>
                                    <button onClick={() => setEditItemId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                                      <X size={14} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3 px-3 font-medium text-slate-700">{item.name}</td>
                                <td className="py-3 px-3 text-right font-semibold text-blue-700">{fmt(item.price)}</td>
                                <td className="py-3 px-3 text-center text-slate-400 text-xs">
                                  {item.duration ? `${item.duration} min` : '—'}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex gap-1 justify-end">
                                    <button
                                      onClick={() => { setEditItemId(item.id); setEditItemName(item.name); setEditItemPrice(String(item.price)); }}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      onClick={() => deleteItem(item.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {(categories.find((c) => c.id === selCatForItem)?.items ?? []).length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-slate-400 text-sm">
                              Hali xizmat qo&apos;shilmagan
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
