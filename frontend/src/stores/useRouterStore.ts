import { create } from 'zustand';

interface RouterState {
  selectedRouterId: string | null;
  selectRouter: (id: string) => void;
  clearRouter: () => void;
}

export const useRouterStore = create<RouterState>((set) => ({
  selectedRouterId: localStorage.getItem('selected_router_id'),

  selectRouter: (id: string) => {
    localStorage.setItem('selected_router_id', id);
    set({ selectedRouterId: id });
  },

  clearRouter: () => {
    localStorage.removeItem('selected_router_id');
    set({ selectedRouterId: null });
  },
}));
