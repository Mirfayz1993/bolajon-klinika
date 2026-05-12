'use client';

import type { ReactNode } from 'react';

// --- Local types --------------------------------------------------------------

export interface TabItem<T extends string> {
  key: T;
  label: string;
  icon: ReactNode;
  count?: number;
  requires?: string;
}

interface TabsNavProps<T extends string> {
  activeTab: T;
  setActiveTab: (tab: T) => void;
  tabs: TabItem<T>[];
}

export function TabsNav<T extends string>({ activeTab, setActiveTab, tabs }: TabsNavProps<T>) {
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            activeTab === tab.key
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.icon} {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
