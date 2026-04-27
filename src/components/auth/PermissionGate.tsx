'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

type Props = {
  require: string;
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGate({ require, fallback = null, children }: Props) {
  const { can } = usePermissions();
  if (!can(require)) return <>{fallback}</>;
  return <>{children}</>;
}
