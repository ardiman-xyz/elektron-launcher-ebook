const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Activation functions
  activateLicense: (licenseKey) =>
    ipcRenderer.invoke("activate-license", licenseKey),
  getActivationInfo: () => ipcRenderer.invoke("get-activation-info"),
  resetActivation: () => ipcRenderer.invoke("reset-activation"),

  // E-book launch functions
  launchEbookInternal: () => ipcRenderer.invoke("launch-ebook-internal"),
  launchEbookBrowser: () => ipcRenderer.invoke("launch-ebook-browser"),
  closeEbookWindow: () => ipcRenderer.invoke("close-ebook-window"),

  // Utility functions
  closeApp: () => ipcRenderer.invoke("close-app"),
  getActivationPath: () => ipcRenderer.invoke("get-activation-path"),
  platform: process.platform,
});

console.log("✅ Preload script completed");
