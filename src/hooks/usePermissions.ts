'use client';

import { createContext, useContext } from 'react';

export type Permissions = {
  loading: boolean;
  ready: boolean;
  isAdmin: boolean;
  allowedPages: string[];
  actionMap: Record<string, boolean>;
  can: (key: string) => boolean;
  refresh: () => Promise<void>;
};

const PermissionsContext = createContext<Permissions | null>(null);

export function usePermissions(): Permissions {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    // Fallback: provider yo'q (login sahifa va h.k.)
    return {
      loading: false,
      ready: true,
      isAdmin: false,
      allowedPages: [],
      actionMap: {},
      can: () => false,
      refresh: async () => {},
    };
  }
  return ctx;
}

export { PermissionsContext };
