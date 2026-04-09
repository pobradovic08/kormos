import { create } from 'zustand';

interface ClusterState {
  selectedClusterId: string | null;
  selectCluster: (id: string) => void;
  clearCluster: () => void;
}

export const useClusterStore = create<ClusterState>((set, get) => ({
  selectedClusterId: localStorage.getItem('selected_cluster_id'),

  selectCluster: (id: string) => {
    if (get().selectedClusterId === id) return;
    localStorage.setItem('selected_cluster_id', id);
    set({ selectedClusterId: id });
  },

  clearCluster: () => {
    localStorage.removeItem('selected_cluster_id');
    set({ selectedClusterId: null });
  },
}));
