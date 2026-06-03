"use strict";
const electron = require("electron");
const api = {
  dashboard: {
    getStats: () => electron.ipcRenderer.invoke("dashboard:getStats"),
    getChartData: (days) => electron.ipcRenderer.invoke("dashboard:getChartData", days),
    getTopCustomers: (limit) => electron.ipcRenderer.invoke("dashboard:getTopCustomers", limit),
    getRecentTransactions: (limit) => electron.ipcRenderer.invoke("dashboard:getRecentTransactions", limit)
  },
  customers: {
    lookup: (phone) => electron.ipcRenderer.invoke("customers:lookup", phone),
    list: (params) => electron.ipcRenderer.invoke("customers:list", params),
    get: (id) => electron.ipcRenderer.invoke("customers:get", id),
    update: (id, data) => electron.ipcRenderer.invoke("customers:update", id, data),
    getVip: () => electron.ipcRenderer.invoke("customers:getVip"),
    exportCsv: () => electron.ipcRenderer.invoke("customers:exportCsv")
  },
  transactions: {
    create: (data) => electron.ipcRenderer.invoke("transactions:create", data),
    list: (params) => electron.ipcRenderer.invoke("transactions:list", params),
    exportCsv: () => electron.ipcRenderer.invoke("transactions:exportCsv")
  },
  cashback: {
    getRule: () => electron.ipcRenderer.invoke("cashback:getRule"),
    updateRule: (data) => electron.ipcRenderer.invoke("cashback:updateRule", data)
  },
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    update: (data) => electron.ipcRenderer.invoke("settings:update", data),
    verifyPin: (pin) => electron.ipcRenderer.invoke("settings:verifyPin", pin)
  },
  database: {
    export: () => electron.ipcRenderer.invoke("database:export"),
    import: (jsonData) => electron.ipcRenderer.invoke("database:import", jsonData),
    backup: () => electron.ipcRenderer.invoke("database:backup")
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
