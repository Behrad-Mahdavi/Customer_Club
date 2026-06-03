/// <reference types="vite/client" />

import type { ElectronAPI } from './types/api'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
