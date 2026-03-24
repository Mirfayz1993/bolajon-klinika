# Yangi sahifa yaratish (Next.js 14 App Router + Tailwind)

## Qadamlar

1. `src/app/(dashboard)/[modul]/page.tsx` fayl yarat
2. `src/app/(dashboard)/layout.tsx` ga navigatsiya linki qo'sh
3. `public/locales/uz-latin.json` va `uz-cyrillic.json` ga i18n kalitlari qo'sh

## Sahifa shablon

```tsx
"use client";

import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Item {
  id: string;
  // ... maydonlar
}

export default function ModulPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetch('/api/modul');
    setItems(await res.json());
    setLoading(false);
  }

  async function handleSubmit(data: Partial<Item>) {
    if (editItem) {
      await fetch(`/api/modul/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      await fetch('/api/modul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }
    await loadData();
    setIsModalOpen(false);
    setEditItem(null);
  }

  async function handleDelete(id: string) {
    if (!confirm(t.common.confirmDelete)) return;
    await fetch(`/api/modul/${id}`, { method: 'DELETE' });
    await loadData();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t.modul.title}</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          {t.common.add}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">{t.common.loading}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t.modul.field}</th>
                <th className="px-4 py-3 font-medium w-24">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{/* maydon */}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditItem(item); setIsModalOpen(true); }}
                        className="text-slate-400 hover:text-blue-600">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(item.id)}
                        className="text-slate-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">
              {editItem ? t.common.edit : t.common.add}
            </h2>
            {/* Forma */}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setIsModalOpen(false); setEditItem(null); }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                {t.common.cancel}
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Qoidalar

- `"use client"` — sahifa boshida MAJBURIY
- `useEffect` + `fetch` — ma'lumot olish uchun
- Prisma ni to'g'ridan-to'g'ri import QILMA — faqat `fetch`
- Barcha matnlar i18n orqali — hardcoded yozma
- Tailwind CSS — inline style ISHLATMA
