import { create } from 'zustand';
import api from './api';

interface TaxEntry {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
}

interface TaxState {
  taxes: TaxEntry[];
  defaultTax: TaxEntry | null;
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  getDefaultRate: () => number;
  getTaxById: (id: string) => TaxEntry | undefined;
}

export const useTaxStore = create<TaxState>((set, get) => ({
  taxes: [],
  defaultTax: null,
  loaded: false,

  reload: async () => {
    set({ loaded: false });
    await get().load();
  },

  load: async () => {
    if (get().loaded) return;
    try {
      const { data } = await api.get('/taxes/active');
      const taxes = data.data || [];
      const defaultTax = taxes.find((t: TaxEntry) => t.isDefault) || null;
      set({ taxes, defaultTax, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  getDefaultRate: () => get().defaultTax?.rate || 0,

  getTaxById: (id: string) => get().taxes.find((t) => t.id === id),
}));
