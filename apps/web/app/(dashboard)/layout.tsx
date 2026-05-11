'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useCurrencyStore } from '@/lib/currency';
import { useTaxStore } from '@/lib/tax';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { CommandPalette } from '@/components/command-palette';

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const loadCurrency = useCurrencyStore((s) => s.load);
  const currencyLoaded = useCurrencyStore((s) => s.loaded);
  const loadTax = useTaxStore((s) => s.load);
  const taxLoaded = useTaxStore((s) => s.loaded);
  useEffect(() => {
    if (isAuthenticated) { loadCurrency(); loadTax(); }
  }, [isAuthenticated, loadCurrency, loadTax]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || (isAuthenticated && (!currencyLoaded || !taxLoaded))) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-64'}`}>
        <Topbar
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
        <footer className="shrink-0 h-8 flex items-center justify-center border-t border-border/40 bg-background">
          <p className="text-[10px] text-muted-foreground/50">&copy; {new Date().getFullYear()} Procunex. Developed by Kinnitech Softwares</p>
        </footer>
      </div>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  );
}
