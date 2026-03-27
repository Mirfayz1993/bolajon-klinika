'use client';

import { usePathname } from 'next/navigation';
import { useLanguage } from '@/hooks/useLanguage';
import { Menu, Bell } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
  userName?: string | null;
  userRole?: string | null;
}

function getPageTitle(pathname: string, nav: Record<string, string>): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? 'dashboard';
  return nav[last] ?? nav['dashboard'] ?? '';
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function Header({ onMenuToggle, userName, userRole }: HeaderProps) {
  const pathname = usePathname();
  const { t, locale, toggleLocale } = useLanguage();

  const nav = t.nav as Record<string, string>;
  const pageTitle = getPageTitle(pathname, nav);
  const roles = t.roles as Record<string, string>;
  const roleLabel = userRole ? (roles[userRole] ?? userRole) : '';

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    HEAD_DOCTOR: 'bg-blue-100 text-blue-700',
    DOCTOR: 'bg-blue-100 text-blue-700',
    HEAD_NURSE: 'bg-green-100 text-green-700',
    NURSE: 'bg-green-100 text-green-700',
    HEAD_LAB_TECH: 'bg-yellow-100 text-yellow-700',
    LAB_TECH: 'bg-yellow-100 text-yellow-700',
    RECEPTIONIST: 'bg-orange-100 text-orange-700',
    SPEECH_THERAPIST: 'bg-pink-100 text-pink-700',
    MASSAGE_THERAPIST: 'bg-teal-100 text-teal-700',
    SANITARY_WORKER: 'bg-slate-100 text-slate-700',
  };

  const avatarColor = userRole ? (roleColors[userRole] ?? 'bg-blue-100 text-blue-700') : 'bg-blue-100 text-blue-700';

  return (
    <header className="fixed top-0 right-0 left-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
      {/* Left: toggle + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-slate-800">{pageTitle}</h1>
      </div>

      {/* Right: locale toggle, notifications, user */}
      <div className="flex items-center gap-2">
        {/* Locale toggle */}
        <button
          onClick={toggleLocale}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          aria-label="Toggle language"
        >
          {locale === 'uz-latin' ? 'КР' : 'UZ'}
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Bildirishnomalar"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}
          >
            {getInitials(userName)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-800 leading-tight">{userName ?? '—'}</p>
            <p className="text-xs text-slate-500 leading-tight">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
