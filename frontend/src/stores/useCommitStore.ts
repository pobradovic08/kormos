import { create } from 'zustand';
import type { PendingChange } from '../api/types';

interface CommitState {
  pendingChanges: Record<string, PendingChange[]>;
  stageChange: (routerId: string, change: Omit<PendingChange, 'id' | 'createdAt'>) => void;
  discardChange: (routerId: string, changeId: string) => void;
  discardAll: (routerId: string) => void;
  clearCommitted: (routerId: string, committedIds: string[]) => void;
  getChangesForRouter: (routerId: string) => PendingChange[];
  getTotalCount: (routerId: string) => number;
}

export const useCommitStore = create<CommitState>((set, get) => ({
  pendingChanges: {},

  stageChange: (routerId, change) => {
    const newChange: PendingChange = {
      ...change,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const existing = state.pendingChanges[routerId] ?? [];
      return {
        pendingChanges: {
          ...state.pendingChanges,
          [routerId]: [...existing, newChange],
        },
      };
    });
  },

  discardChange: (routerId, changeId) => {
    set((state) => {
      const existing = state.pendingChanges[routerId] ?? [];
      const filtered = existing.filter((c) => c.id !== changeId);
      return {
        pendingChanges: {
          ...state.pendingChanges,
          [routerId]: filtered,
        },
      };
    });
  },

  discardAll: (routerId) => {
    set((state) => {
      const { [routerId]: _, ...rest } = state.pendingChanges;
      void _;
      return { pendingChanges: rest };
    });
  },

  clearCommitted: (routerId, committedIds) => {
    set((state) => {
      const existing = state.pendingChanges[routerId] ?? [];
      const idSet = new Set(committedIds);
      const remaining = existing.filter((c) => !idSet.has(c.id));
      return {
        pendingChanges: {
          ...state.pendingChanges,
          [routerId]: remaining,
        },
      };
    });
  },

  getChangesForRouter: (routerId) => {
    return get().pendingChanges[routerId] ?? [];
  },

  getTotalCount: (routerId) => {
    return (get().pendingChanges[routerId] ?? []).length;
  },
}));
