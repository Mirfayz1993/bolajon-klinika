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
      { key: 'tab:statsionar', label: 'Statsionar tab' },
      { key: 'create', label: "Bemor qo'shish" },
      { key: 'edit', label: 'Tahrirlash' },
      { key: 'delete', label: "O'chirish" },
      { key: 'see_prices', label: "Narxlarni ko'rish" },
      { key: 'manage_services', label: 'Xizmatlarni boshqarish' },
      { key: 'order_lab', label: 'Lab buyurtma berish' },
      { key: 'add_vital', label: "Vital qo'shish" },
      { key: 'create_note', label: "Eslatma qo'shish" },
    ],
  },
  {
    path: '/payments',
    label: "To'lovlar",
    actions: [
      { key: 'create', label: "To'lov qo'shish" },
      { key: 'refund', label: "Qaytarish" },
      { key: 'delete', label: "O'chirish" },
      { key: 'see_all', label: "Hammaning to'lovlarini ko'rish" },
    ],
  },
  {
    path: '/lab',
    label: 'Laboratoriya',
    actions: [
      { key: 'create', label: "Test qo'shish" },
      { key: 'result', label: 'Natija kiritish' },
      { key: 'edit_test', label: 'Test tahrirlash' },
      { key: 'delete', label: "O'chirish" },
    ],
  },
  {
    path: '/staff',
    label: 'Xodimlar',
    actions: [
      { key: 'create', label: "Qo'shish" },
      { key: 'edit', label: 'Tahrirlash' },
      { key: 'delete', label: "O'chirish" },
      { key: 'change_password', label: "Parol o'zgartirish" },
      { key: 'manage_permissions', label: 'Ruxsat boshqarish' },
    ],
  },
  {
    path: '/queue',
    label: 'Navbat',
    actions: [
      { key: 'create', label: "Navbat qo'shish" },
      { key: 'call', label: 'Chaqirish' },
      { key: 'mark_done', label: 'Yopish' },
      { key: 'set_urgent', label: 'Shoshilinch' },
    ],
  },
  {
    path: '/rooms',
    label: 'Xonalar',
    actions: [
      { key: 'create', label: "Xona qo'shish" },
      { key: 'edit', label: 'Tahrirlash' },
      { key: 'delete', label: "O'chirish" },
      { key: 'manage_inventory', label: 'Inventar boshqarish' },
      { key: 'assign_responsible', label: "Mas'ul tayinlash" },
    ],
  },
  {
    path: '/admissions',
    label: 'Statsionar',
    actions: [
      { key: 'create', label: "Yotqizish" },
      { key: 'discharge', label: 'Chiqarish' },
      { key: 'edit_rate', label: "Narx o'zgartirish" },
      { key: 'delete', label: "O'chirish" },
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
  {
    path: '/schedule',
    label: 'Jadval',
    actions: [
      { key: 'create', label: "Jadval yaratish" },
      { key: 'edit_others', label: "Boshqalarning jadvalini tahrirlash" },
      { key: 'delete', label: "O'chirish" },
    ],
  },
  { path: '/attendance', label: 'Davomat' },
  {
    path: '/tasks',
    label: 'Vazifalar',
    actions: [
      { key: 'create', label: "Vazifa yaratish" },
      { key: 'assign', label: 'Tayinlash' },
      { key: 'complete_others', label: "Boshqalarning vazifasini yopish" },
      { key: 'delete', label: "O'chirish" },
    ],
  },
  { path: '/doctor-queue', label: 'Mutaxassis navbati' },
  {
    path: '/reports',
    label: 'Hisobotlar',
    actions: [
      { key: 'export', label: 'Eksport' },
      { key: 'see_financial', label: "Moliyaviy hisobot ko'rish" },
    ],
  },
  {
    path: '/settings',
    label: 'Sozlamalar',
    actions: [
      { key: 'manage_specs', label: 'Mutaxassisliklar' },
      { key: 'manage_room_types', label: 'Xona turlari' },
      { key: 'manage_service_categories', label: 'Xizmat kategoriyalari' },
      { key: 'manage_service_items', label: 'Xizmat items' },
    ],
  },
  { path: '/audit-logs', label: 'Audit log' },
  { path: '/settings/permissions', label: 'Ruxsatlar' },
  {
    path: '/expenses',
    label: 'Xarajatlar',
    actions: [
      { key: 'create', label: "Xarajat qo'shish" },
      { key: 'edit', label: 'Tahrirlash' },
      { key: 'delete', label: "O'chirish" },
    ],
  },
  {
    path: '/pharmacy',
    label: 'Dorixona',
    actions: [
      { key: 'create', label: "Dori qo'shish" },
      { key: 'dispense', label: 'Berish' },
      { key: 'writeoff', label: 'Hisobdan chiqarish' },
      { key: 'edit', label: 'Tahrirlash' },
      { key: 'manage_suppliers', label: "Ta'minotchilar boshqarish" },
    ],
  },
  {
    path: '/medical-records',
    label: "Tibbiy yozuvlar",
    actions: [
      { key: 'create', label: "Tashxis qo'shish" },
      { key: 'edit', label: 'Tahrirlash' },
      { key: 'delete', label: "O'chirish" },
    ],
  },
];
