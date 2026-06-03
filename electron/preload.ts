import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../src/types/api'

const api: ElectronAPI = {
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:getStats'),
    getChartData: (days) => ipcRenderer.invoke('dashboard:getChartData', days),
    getTopCustomers: (limit) => ipcRenderer.invoke('dashboard:getTopCustomers', limit),
    getRecentTransactions: (limit) => ipcRenderer.invoke('dashboard:getRecentTransactions', limit),
  },
  customers: {
    lookup: (phone) => ipcRenderer.invoke('customers:lookup', phone),
    list: (params) => ipcRenderer.invoke('customers:list', params),
    get: (id) => ipcRenderer.invoke('customers:get', id),
    update: (id, data) => ipcRenderer.invoke('customers:update', id, data),
    getVip: () => ipcRenderer.invoke('customers:getVip'),
    exportCsv: () => ipcRenderer.invoke('customers:exportCsv'),
  },
  transactions: {
    create: (data) => ipcRenderer.invoke('transactions:create', data),
    list: (params) => ipcRenderer.invoke('transactions:list', params),
    exportCsv: () => ipcRenderer.invoke('transactions:exportCsv'),
  },
  cashback: {
    getRule: () => ipcRenderer.invoke('cashback:getRule'),
    updateRule: (data) => ipcRenderer.invoke('cashback:updateRule', data),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (data) => ipcRenderer.invoke('settings:update', data),
    verifyPin: (pin) => ipcRenderer.invoke('settings:verifyPin', pin),
  },
  database: {
    export: () => ipcRenderer.invoke('database:export'),
    import: (jsonData) => ipcRenderer.invoke('database:import', jsonData),
    backup: () => ipcRenderer.invoke('database:backup'),
  },
}

contextBridge.exposeInMainWorld('api', api)
