'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/breadcrumbs';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Moon,
  Bell,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Map pathnames to readable labels
const pathLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/purchase-requests': 'Purchase Requests',
  '/purchase-orders': 'Purchase Orders',
  '/rfq': 'RFQ',
  '/vendors': 'Vendors',
  '/contracts': 'Contracts',
  '/products': 'Products',
  '/warehouses': 'Warehouses',
  '/stock-movements': 'Stock Movements',
  '/budgets': 'Budgets',
  '/spend-analytics': 'Spend Analytics',
  '/reports': 'Reports',
  '/audit-trail': 'Audit Trail',
  '/departments': 'Departments',
  '/users': 'Users',
  '/workflows': 'Workflows',
  '/supplier-scoring': 'Supplier Scoring',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};

function getPageLabel(pathname: string): string {
  // Exact match
  if (pathLabels[pathname]) return pathLabels[pathname];
  // Try matching the first segment
  const base = '/' + (pathname.split('/').find(Boolean) ?? '');
  return pathLabels[base] || 'Page';
}

interface TopbarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  onOpenCommandPalette?: () => void;
}

export function Topbar({
  onToggleSidebar,
  sidebarCollapsed,
  onOpenCommandPalette,
}: Readonly<TopbarProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();

  const pageLabel = getPageLabel(pathname);
  const initials = user ? getInitials(user.firstName, user.lastName) : 'U';

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notifications/unread-count'),
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.data?.count || 0;

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 sm:px-6">
      {/* Left: Toggle + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>

        <Breadcrumbs
          items={[
            { label: 'Home', href: '/dashboard' },
            { label: pageLabel },
          ]}
        />
      </div>

      {/* Right: Actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:inline-flex items-center gap-2 rounded-lg border bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </button>

        {/* Mobile search button */}
        <button
          onClick={onOpenCommandPalette}
          className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>

        {/* Notifications */}
        <button
          onClick={() => router.push('/notifications')}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </div>
              <span className="hidden md:inline-block text-sm font-medium">
                {user ? `${user.firstName} ${user.lastName}` : 'User'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {user ? `${user.firstName} ${user.lastName}` : 'User'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.email || ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
