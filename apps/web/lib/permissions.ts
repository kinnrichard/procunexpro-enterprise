import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export type PermAction = 'view' | 'create' | 'edit' | 'delete';

// Current user's effective permissions. `can(module, action)` gates UI buttons.
// SUPERADMIN/ADMIN come back with admin:true → everything allowed.
export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['permissions-mine'],
    queryFn: () => api.get('/permissions/mine'),
    staleTime: 5 * 60 * 1000,
  });

  const admin: boolean = data?.data?.admin ?? false;
  const modules: Record<string, Record<PermAction, boolean>> = data?.data?.modules ?? {};

  const can = (module: string, action: PermAction): boolean => {
    if (admin) return true;
    return !!modules?.[module]?.[action];
  };

  return { can, isAdmin: admin, ready: !!data, isLoading };
}
