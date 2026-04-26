export interface NavPageAction {
  key: string;   // e.g. "create", "delete"
  label: string; // e.g. "Qo'shish", "O'chirish"
}

export interface NavPage {
  path: string;
  label: string;
  actions?: NavPageAction[];
}

export const MANAGED_PAGES: NavPage[] = [
  { path: '/dashboard', label: 'Dashboard' },
  {
    path: '/patients',
    label: 'Bemorlar',
    actions: [
      { key: 'tab:xizmatlar', label: 'Xizmatlar tab' },
      { key: 'tab:tashxislar', label: 'Tashxislar tab' },
      { key: 'tab:hamshira', label: 'Hamshira tab' },
      { key: 'tab:laboratoriya', label: 'Laboratoriya tab' },
      { key: 'create', label: "Bemor qo'shish" },
      { key: 'edit', label: 'Tahrirlash' },
      { key: 'delete', label: "O'chirish" },
    ],
  },
  {
    path: '/payments',
    label: "To'lovlar",
    actions: [
      { key: 'create', label: "To'lov qo'shish" },
      { key: 'refund', label: "Qaytarish" },
    ],
  },
  {
    path: '/lab',
    label: 'Laboratoriya',
    actions: [
      { key: 'create', label: "Test qo'shish" },
      { key: 'result', label: 'Natija kiritish' },
    ],
  },
  {
    path: '/staff',
    label: 'Xodimlar',
    actions: [
      { key: 'create', label: "Qo'shish" },
      { key: 'edit', label: 'Tahrirlash' },
      { key: 'delete', label: "O'chirish" },
    ],
  },
  {
    path: '/queue',
    label: 'Navbat',
    actions: [
      { key: 'create', label: "Navbat qo'shish" },
      { key: 'call', label: 'Chaqirish' },
    ],
  },
  { path: '/rooms', label: 'Xonalar' },
  {
    path: '/admissions',
    label: 'Statsionar',
    actions: [
      { key: 'create', label: "Yotqizish" },
      { key: 'discharge', label: 'Chiqarish' },
    ],
  },
  {
    path: '/ambulatory',
    label: 'Ambulator bo\'lim',
    actions: [
      { key: 'create', label: "Joylashtirish" },
      { key: 'discharge', label: 'Chiqarish' },
    ],
  },
  { path: '/schedule', label: 'Jadval' },
  { path: '/attendance', label: 'Davomat' },
  { path: '/tasks', label: 'Vazifalar' },
  { path: '/doctor-queue', label: 'Mutaxassis navbati' },
  { path: '/reports', label: 'Hisobotlar' },
  { path: '/settings', label: 'Sozlamalar' },
  { path: '/audit-logs', label: 'Audit log' },
  { path: '/settings/permissions', label: 'Ruxsatlar' },
  { path: '/expenses', label: 'Xarajatlar' },
  {
    path: '/pharmacy',
    label: 'Dorixona',
    actions: [
      { key: 'create', label: "Dori qo'shish" },
      { key: 'dispense', label: 'Berish' },
      { key: 'writeoff', label: 'Hisobdan chiqarish' },
    ],
  },
];
