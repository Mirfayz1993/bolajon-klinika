'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { PermissionsContext, type Permissions } from '@/hooks/usePermissions';

type ApiResponse = {
  allowedPages: string[];
  actionMap: Record<string, boolean>;
  permissions: { page: string; level: string }[];
};

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { status, data: session } = useSession();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const fetchPerms = useCallback(async () => {
    if (status !== 'authenticated') return;
    setLoading(true);
    try {
      const res = await fetch('/api/permissions/my');
      if (!res.ok) throw new Error('Failed');
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setReady(true);
    } catch (err) {
      console.error('[PermissionsProvider] fetch xato:', err);
      setReady(true); // crash bo'lmasin
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated' && !ready) {
      fetchPerms();
    } else if (status === 'unauthenticated') {
      setReady(true); // login bo'lmagan
    }
  }, [status, ready, fetchPerms]);

  const isAdmin = session?.user?.role === 'ADMIN';

  const can = useCallback(
    (key: string): boolean => {
      if (!ready) return false; // loading paytida hech narsa ko'rinmasin (komponent skeleton ko'rsatadi)
      if (isAdmin) return true; // ADMIN bypass
      if (!data) return false;
      // page-level: allowedPages.includes
      if (data.allowedPages.includes(key)) return true;
      // action-level: actionMap[key] === true
      return data.actionMap[key] === true;
    },
    [ready, isAdmin, data]
  );

  const value: Permissions = {
    loading,
    ready,
    isAdmin,
    allowedPages: data?.allowedPages ?? [],
    actionMap: data?.actionMap ?? {},
    can,
    refresh: fetchPerms,
  };

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}
