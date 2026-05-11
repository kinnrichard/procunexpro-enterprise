'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Command } from 'cmdk';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Building2,
  Package,
  Warehouse,
  ArrowLeftRight,
  Network,
  Users,
  Plus,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';


interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  keywords?: string[];
}

export function CommandPalette({ open, onOpenChange }: Readonly<CommandPaletteProps>) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange]
  );

  const navigationItems: CommandItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, onSelect: () => navigate('/dashboard'), keywords: ['home', 'overview'] },
    { label: 'Purchase Requests', icon: FileText, onSelect: () => navigate('/purchase-requests'), keywords: ['pr', 'requisition'] },
    { label: 'Purchase Orders', icon: ShoppingCart, onSelect: () => navigate('/purchase-orders'), keywords: ['po', 'order'] },
    { label: 'Vendors', icon: Building2, onSelect: () => navigate('/vendors'), keywords: ['supplier'] },
    { label: 'Products', icon: Package, onSelect: () => navigate('/products'), keywords: ['item', 'inventory'] },
    { label: 'Warehouses', icon: Warehouse, onSelect: () => navigate('/warehouses'), keywords: ['storage', 'location'] },
    { label: 'Stock Movements', icon: ArrowLeftRight, onSelect: () => navigate('/stock-movements'), keywords: ['transfer', 'stock'] },
    { label: 'Departments', icon: Network, onSelect: () => navigate('/departments'), keywords: ['dept', 'team'] },
    { label: 'Users', icon: Users, onSelect: () => navigate('/users'), keywords: ['people', 'staff'] },
    { label: 'RFQ', icon: FileText, onSelect: () => navigate('/rfq'), keywords: ['quotation', 'quote', 'bid'] },
    { label: 'Contracts', icon: FileText, onSelect: () => navigate('/contracts'), keywords: ['agreement'] },
    { label: 'Budgets', icon: LayoutDashboard, onSelect: () => navigate('/budgets'), keywords: ['fiscal', 'allocation'] },
    { label: 'Spend Analytics', icon: LayoutDashboard, onSelect: () => navigate('/spend-analytics'), keywords: ['spending', 'analysis'] },
    { label: 'Supplier Scoring', icon: LayoutDashboard, onSelect: () => navigate('/supplier-scoring'), keywords: ['rating', 'performance'] },
  ];

  const actionItems: CommandItem[] = [
    { label: 'Create Purchase Request', icon: Plus, onSelect: () => navigate('/purchase-requests?action=create'), keywords: ['new', 'pr'] },
    { label: 'Create Purchase Order', icon: Plus, onSelect: () => navigate('/purchase-orders?action=create'), keywords: ['new', 'po'] },
    { label: 'Add Vendor', icon: Plus, onSelect: () => navigate('/vendors?action=create'), keywords: ['new', 'supplier'] },
    { label: 'Add Product', icon: Plus, onSelect: () => navigate('/products?action=create'), keywords: ['new', 'item'] },
  ];

  const settingsItems: CommandItem[] = [
    { label: 'Departments', icon: Network, onSelect: () => navigate('/departments') },
    { label: 'Users', icon: Users, onSelect: () => navigate('/users') },
    {
      label: 'Toggle Dark Mode',
      icon: theme === 'dark' ? Sun : Moon,
      onSelect: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        onOpenChange(false);
      },
      keywords: ['theme', 'light', 'appearance'],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl max-w-lg [&>button]:hidden">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex items-center border-b px-3">
            <svg
              className="mr-2 h-4 w-4 shrink-0 opacity-50"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Command.Input
              placeholder="Type a command or search..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation">
              {navigationItems.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label + ' ' + (item.keywords?.join(' ') || '')}
                  onSelect={item.onSelect}
                  className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <item.icon className="mr-2.5 h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="mx-1 my-1 h-px bg-border" />

            <Command.Group heading="Actions">
              {actionItems.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label + ' ' + (item.keywords?.join(' ') || '')}
                  onSelect={item.onSelect}
                  className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <item.icon className="mr-2.5 h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="mx-1 my-1 h-px bg-border" />

            <Command.Group heading="Settings">
              {settingsItems.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label + ' ' + (item.keywords?.join(' ') || '')}
                  onSelect={item.onSelect}
                  className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <item.icon className="mr-2.5 h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
