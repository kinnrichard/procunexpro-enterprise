import { create } from 'zustand';
import api from './api';

interface CurrencyState {
  code: string;
  symbol: string;
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  format: (amount: number, overrideCode?: string) => string;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  code: 'USD',
  symbol: '$',
  loaded: false,

  reload: async () => {
    set({ loaded: false });
    await get().load();
  },

  load: async () => {
    if (get().loaded) return;
    try {
      const { data } = await api.get('/currencies/active');
      const def = (data.data || []).find((c: any) => c.isDefault);
      if (def) {
        const state = { code: def.code, symbol: def.symbol || def.code, loaded: true };
        set(state);
        if (typeof window !== 'undefined') (window as any).__CURRENCY_STORE__ = state;
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  format: (amount: number, overrideCode?: string) => {
    const code = overrideCode || get().code;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
    } catch {
      return `${code} ${amount.toFixed(2)}`;
    }
  },
}));
