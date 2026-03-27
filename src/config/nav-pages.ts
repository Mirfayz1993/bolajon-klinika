export interface NavPage {
  path: string;
  label: string;
}

export const MANAGED_PAGES: NavPage[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/patients', label: 'Bemorlar' },
  { path: '/appointments', label: 'Qabullar' },
  { path: '/payments', label: "To'lovlar" },
  { path: '/lab', label: 'Laboratoriya' },
  { path: '/staff', label: 'Xodimlar' },
  { path: '/queue', label: 'Navbat' },
  { path: '/rooms', label: 'Xonalar' },
  { path: '/schedule', label: 'Jadval' },
  { path: '/reports', label: 'Hisobotlar' },
  { path: '/settings', label: 'Sozlamalar' },
  { path: '/audit-logs', label: 'Audit log' },
  { path: '/settings/permissions', label: 'Ruxsatlar' },
  { path: '/medical-records', label: 'Tibbiy kartalar' },
];
