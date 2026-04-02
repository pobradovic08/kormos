import { create } from 'zustand';

interface PortalState {
  portalName: string;
  defaultTimezone: string;
  supportEmail: string;
  setPortalSettings: (name: string, timezone: string, email: string) => void;
}

export const usePortalStore = create<PortalState>((set) => ({
  portalName: 'Kormos',
  defaultTimezone: '',
  supportEmail: '',

  setPortalSettings: (name: string, timezone: string, email: string) => {
    set({
      portalName: name || 'Kormos',
      defaultTimezone: timezone,
      supportEmail: email,
    });
  },
}));
