import { create } from 'zustand'
import type { Settings } from '../types/api'

const AUTH_KEY = 'cc_auth'

interface AppState {
  settings: Settings | null
  isAuthenticated: boolean
  sidebarCollapsed: boolean
  setSettings: (settings: Settings) => void
  setAuthenticated: (value: boolean) => void
  logout: () => void
  toggleSidebar: () => void
  loadSettings: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  settings: null,
  isAuthenticated: sessionStorage.getItem(AUTH_KEY) === '1',
  sidebarCollapsed: false,
  setSettings: (settings) => set({ settings }),
  setAuthenticated: (value) => {
    if (value) sessionStorage.setItem(AUTH_KEY, '1')
    else sessionStorage.removeItem(AUTH_KEY)
    set({ isAuthenticated: value })
  },
  logout: () => {
    sessionStorage.removeItem(AUTH_KEY)
    set({ isAuthenticated: false })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  loadSettings: async () => {
    const settings = await window.api.settings.get()
    set({ settings })
  },
}))
