'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  MonitorPlay,
  BedDouble,
  Hospital,
  CreditCard,
  Pill,
  Receipt,
  FlaskConical,
  UserCog,
  CalendarRange,
  BarChart3,
  ShieldCheck,
  Settings,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogOut,
  Stethoscope,
  ActivitySquare,
  Clock,
  PhoneCall,
  ClipboardList,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  userName?: string | null;
  userRole?: string | null;
}

interface NavItem {
  key: string;
  href?: string;
  icon: React.ReactNode;
  labelKey: string;
  external?: boolean;
  children?: NavItem[];
}

export default function Sidebar({ collapsed, onToggle, userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null);
  const [unreadTasks, setUnreadTasks] = useState(0);

  useEffect(() => {
    fetch('/api/permissions/my')
      .then((r) => r.json())
      .then((d) => setAllowedPages(d.allowedPages ?? null))
      .catch(() => setAllowedPages(null));
  }, []);

  useEffect(() => {
    const fetchUnread = () => {
      fetch('/api/tasks?unread=true')
        .then((r) => r.json())
        .then((d) => setUnreadTasks(d.count ?? 0))
        .catch(() => {});
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 30000);
    return () => clearInterval(iv);
  }, []);

  const canAccess = (href: string) => {
    if (!allowedPages) return true; // yuklanayotganda yashirmaymiz
    return allowedPages.includes(href);
  };

  const getRoleLabel = (role: string | null | undefined): string => {
    const roles = t.roles as Record<string, string>;
    return role ? (roles[role] ?? role) : '';
  };
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    clinic: true,
    finance: true,
  });

  const navItems: NavItem[] = [
    {
      key: 'dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard size={20} />,
      labelKey: 'dashboard',
    },
    {
      key: 'patients',
      href: '/patients',
      icon: <Users size={20} />,
      labelKey: 'patients',
    },
    {
      key: 'queue',
      href: '/queue-display',
      icon: <MonitorPlay size={20} />,
      labelKey: 'queue',
      external: true,
    },
    {
      key: 'clinic',
      icon: <Stethoscope size={20} />,
      labelKey: 'clinic',
      children: [
        {
          key: 'rooms',
          href: '/rooms',
          icon: <BedDouble size={20} />,
          labelKey: 'rooms',
        },
        {
          key: 'admissions',
          href: '/admissions',
          icon: <Hospital size={20} />,
          labelKey: 'admissions',
        },
        {
          key: 'ambulatory',
          href: '/ambulatory',
          icon: <ActivitySquare size={20} />,
          labelKey: 'ambulatory',
        },
      ],
    },
    {
      key: 'finance',
      icon: <CreditCard size={20} />,
      labelKey: 'finance',
      children: [
        {
          key: 'payments',
          href: '/payments',
          icon: <CreditCard size={20} />,
          labelKey: 'payments',
        },
        {
          key: 'pharmacy',
          href: '/pharmacy',
          icon: <Pill size={20} />,
          labelKey: 'pharmacy',
        },
        {
          key: 'expenses',
          href: '/expenses',
          icon: <Receipt size={20} />,
          labelKey: 'expenses',
        },
      ],
    },
    {
      key: 'lab',
      href: '/lab',
      icon: <FlaskConical size={20} />,
      labelKey: 'lab',
    },
    {
      key: 'staff',
      href: '/staff',
      icon: <UserCog size={20} />,
      labelKey: 'staff',
    },
    {
      key: 'schedule',
      href: '/schedule',
      icon: <CalendarRange size={20} />,
      labelKey: 'schedule',
    },
    {
      key: 'attendance',
      href: '/attendance',
      icon: <Clock size={20} />,
      labelKey: 'attendance',
    },
    {
      key: 'tasks',
      href: '/tasks',
      icon: <ClipboardList size={20} />,
      labelKey: 'tasks',
    },
    {
      key: 'doctor-queue',
      href: '/doctor-queue',
      icon: <PhoneCall size={20} />,
      labelKey: 'doctorQueue',
    },
    {
      key: 'reports',
      href: '/reports',
      icon: <BarChart3 size={20} />,
      labelKey: 'reports',
    },
    {
      key: 'audit',
      href: '/audit-logs',
      icon: <ShieldCheck size={20} />,
      labelKey: 'audit',
    },
    {
      key: 'settings',
      href: '/settings',
      icon: <Settings size={20} />,
      labelKey: 'settings',
    },
  ];

  const adminNavItems: NavItem[] = userRole === 'ADMIN'
    ? [
        {
          key: 'permissions',
          href: '/settings/permissions',
          icon: <KeyRound size={20} />,
          labelKey: 'permissions',
        },
      ]
    : [];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getLabel = (labelKey: string): string => {
    const navT = t.nav as Record<string, string>;
    return navT[labelKey] ?? labelKey;
  };

  const renderNavItem = (item: NavItem) => {
    // Group with children (accordion)
    if (item.children) {
      const visibleChildren = item.children.filter((c) => !c.href || canAccess(c.href));
      if (visibleChildren.length === 0) return null;

      const expanded = expandedGroups[item.key];
      const hasActiveChild = visibleChildren.some((c) => c.href && isActive(c.href));

      return (
        <div key={item.key}>
          <button
            onClick={() => toggleGroup(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
              ${hasActiveChild ? 'text-blue-700' : 'text-slate-600 hover:bg-blue-50 hover:text-slate-900'}`}
            title={collapsed ? getLabel(item.labelKey) : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="flex-1 text-sm font-medium">{getLabel(item.labelKey)}</span>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </>
            )}
          </button>

          {!collapsed && expanded && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
              {visibleChildren.map((child) => renderNavItem(child))}
            </div>
          )}
        </div>
      );
    }

    // Regular link
    if (!item.href) return null;
    if (!canAccess(item.href)) return null;
    const active = isActive(item.href);
    const isTasks = item.key === 'tasks';

    return (
      <Link
        key={item.key}
        href={item.href}
        target={item.external ? '_blank' : undefined}
        rel={item.external ? 'noopener noreferrer' : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
          ${active
            ? 'bg-blue-100 text-blue-700 font-semibold'
            : 'text-slate-600 hover:bg-blue-50 hover:text-slate-900'
          }`}
        title={collapsed ? getLabel(item.labelKey) : undefined}
      >
        <span className="flex-shrink-0 relative">
          {item.icon}
          {isTasks && unreadTasks > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadTasks > 9 ? '9+' : unreadTasks}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="flex-1 text-sm font-medium">{getLabel(item.labelKey)}</span>
        )}
        {!collapsed && isTasks && unreadTasks > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {unreadTasks > 9 ? '9+' : unreadTasks}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-30
        ${collapsed ? 'w-16' : 'w-[230px]'}`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-slate-200 h-16 flex-shrink-0 ${collapsed ? 'justify-center px-2' : 'px-4 gap-3'}`}>
        <div className="flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden">
          <Image src="/photo_2026-03-24_20-39-19.jpg" alt="Bolajon Klinikasi" width={36} height={36} className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 leading-tight truncate">Bolajon</p>
            <p className="text-xs text-slate-500 leading-tight truncate">Klinikasi</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => renderNavItem(item))}
        {adminNavItems.length > 0 && (
          <div className="mt-1 pt-1 border-t border-slate-100">
            {adminNavItems.map((item) => renderNavItem(item))}
          </div>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-slate-200 p-2 flex-shrink-0">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-semibold text-slate-800 truncate">{userName ?? '—'}</p>
            <p className="text-xs text-slate-500 truncate">{getRoleLabel(userRole)}</p>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors
            ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? t.auth.logout : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm font-medium">{t.auth.logout}</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors z-10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}
