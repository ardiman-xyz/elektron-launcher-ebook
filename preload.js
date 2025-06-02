// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // License management
  activateLicense: (licenseKey) =>
    ipcRenderer.invoke("activate-license", licenseKey),
  getActivationInfo: () => ipcRenderer.invoke("get-activation-info"),
  getLicenseInfo: () => ipcRenderer.invoke("get-license-info"),
  verifyLicense: () => ipcRenderer.invoke("verify-license"),
  resetActivation: () => ipcRenderer.invoke("reset-activation"),

  // App functionality
  launchEbookInternal: () => ipcRenderer.invoke("launch-ebook-internal"),
  closeApp: () => ipcRenderer.invoke("close-app"),

  // System info
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // Usage logging
  logUsage: (usageData) => ipcRenderer.invoke("log-usage", usageData),

  // UI utilities
  showMessage: (options) => ipcRenderer.invoke("show-message", options),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // Feature access control
  hasFeature: async (feature) => {
    try {
      const licenseInfo = await ipcRenderer.invoke("get-license-info");
      return licenseInfo.isActivated && licenseInfo.features.includes(feature);
    } catch (error) {
      return false;
    }
  },

  // Restriction checking
  getRestriction: async (key) => {
    try {
      const licenseInfo = await ipcRenderer.invoke("get-license-info");
      return licenseInfo.restrictions ? licenseInfo.restrictions[key] : null;
    } catch (error) {
      return null;
    }
  },

  // License status
  isLicenseValid: async () => {
    try {
      const licenseInfo = await ipcRenderer.invoke("get-license-info");
      return licenseInfo.isActivated;
    } catch (error) {
      return false;
    }
  },
});

console.log("🔗 Preload script loaded with license APIs");
