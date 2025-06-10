// main.js
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");

// FIXED: Use SimpleLicense instead of ActivationManager
const SimpleLicense = require("./src/SimpleLicense");
const DeviceManager = require("./src/device");
const SimpleDecryptor = require("./src/SimpleDecryptor");

let mainWindow;
let ebookWindow;
let license; // SimpleLicense instance
let deviceManager;
let simpleDecryptor;
console.log("🌍 Environment loaded:");
console.log("📡 API URL:", process.env.LICENSE_API_URL || "Default URL");
console.log("🏃 NODE_ENV:", process.env.NODE_ENV || "development");

app.whenReady().then(async () => {
  console.log("✅ App ready");

  // Initialize SimpleLicense system
  license = new SimpleLicense();
  deviceManager = new DeviceManager();
  simpleDecryptor = new SimpleDecryptor();

  await createWindow();
});

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600, // Dari 500 menjadi 600
    height: 800, // Dari 700 menjadi 800
    minWidth: 550, // Minimum width
    minHeight: 700, // Minimum height
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets/icon.png"),
    show: false,
  });

  // Check license status and show appropriate page
  await checkLicenseAndShowPage();

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (ebookWindow) {
      ebookWindow.close();
    }
  });
}

// Check license and show appropriate page
async function checkLicenseAndShowPage() {
  try {
    const isLicenseValid = await license.isValid();

    if (isLicenseValid) {
      console.log("✅ Valid license found, showing dashboard");
      mainWindow.loadFile("app/dashboard.html");

      // Verify license with server in background
      license.verify().then((result) => {
        if (!result.success) {
          console.warn("⚠️ License verification failed:", result.message);
        }
      });
    } else {
      console.log("❌ No valid license, showing activation page");
      mainWindow.loadFile("app/activation.html");
    }
  } catch (error) {
    console.error("❌ Error checking license:", error);
    mainWindow.loadFile("app/activation.html");
  }
}

// Create ebook viewer window
async function createEbookWindow() {
  try {
    console.log("📖 Starting e-book window with decryption...");

    if (ebookWindow && !ebookWindow.isDestroyed()) {
      console.log("👁️ E-book window already exists, focusing...");
      ebookWindow.focus();
      return { success: true, message: "E-book window focused" };
    }

    // Check if encrypted flipbook is available
    if (!simpleDecryptor.isAvailable()) {
      throw new Error("Encrypted flipbook not found");
    }

    console.log("🔓 Decrypting flipbook...");
    const indexPath = await simpleDecryptor.decryptFlipbook();

    if (!indexPath) {
      throw new Error("Failed to decrypt flipbook");
    }

    console.log("✅ Flipbook decrypted, creating window...");

    const { screen } = require("electron");
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const ebookWidth = Math.min(1200, width - 50);
    const ebookHeight = Math.min(850, height - 50);

    ebookWindow = new BrowserWindow({
      width: ebookWidth,
      height: ebookHeight,
      minWidth: 900,
      minHeight: 700,
      title: "📚 Protected E-book Viewer",
      show: true,
      center: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Allow local files
      },
      autoHideMenuBar: true,
      parent: mainWindow,
    });

    // Load decrypted flipbook
    await ebookWindow.loadFile(indexPath);

    ebookWindow.on("closed", () => {
      // Cleanup temp files when window closes
      if (simpleDecryptor) {
        simpleDecryptor.cleanup();
      }
      ebookWindow = null;
      console.log("📖 E-book window closed");
    });

    // Log usage when ebook is opened
    license.logUsage({
      action: "ebook_opened",
      feature: "viewer",
      sessionStart: new Date().toISOString(),
    });

    console.log("✅ E-book window opened successfully");
    return { success: true, message: "E-book opened with decryption" };
  } catch (error) {
    console.error("❌ Error creating e-book window:", error);
    return { success: false, message: error.message };
  }
}

// === IPC HANDLERS ===

// License activation - FIXED to use SimpleLicense
ipcMain.handle("activate-license", async (event, licenseKey) => {
  try {
    console.log("🔑 Activating license:", licenseKey);
    const result = await license.activate(licenseKey);

    if (result.success) {
      // Redirect to dashboard after successful activation
      setTimeout(() => {
        mainWindow.loadFile("app/dashboard.html");
      }, 2000);
    }

    return result;
  } catch (error) {
    console.error("❌ License activation error:", error);
    return { success: false, message: error.message };
  }
});

// Get activation info
ipcMain.handle("get-activation-info", async () => {
  try {
    const licenseInfo = await license.getLicenseInfo();
    return licenseInfo.isActivated ? licenseInfo : null;
  } catch (error) {
    console.error("❌ Error getting activation info:", error);
    return null;
  }
});

// Get full license info
ipcMain.handle("get-license-info", async () => {
  try {
    return await license.getLicenseInfo();
  } catch (error) {
    console.error("❌ Error getting license info:", error);
    return { isActivated: false, type: "none" };
  }
});

// Verify license
ipcMain.handle("verify-license", async () => {
  try {
    return await license.verify();
  } catch (error) {
    console.error("❌ License verification error:", error);
    return { success: false, message: error.message };
  }
});

// Reset activation
ipcMain.handle("reset-activation", async () => {
  try {
    const result = await license.deactivate();

    if (result.success) {
      // Redirect to activation page
      setTimeout(() => {
        mainWindow.loadFile("app/activation.html");
      }, 1000);
    }

    return result;
  } catch (error) {
    console.error("❌ Reset activation error:", error);
    return { success: false, message: error.message };
  }
});

// Launch ebook internal
ipcMain.handle("launch-ebook-internal", async () => {
  try {
    // Check license before launching
    const isValid = await license.isValid();
    if (!isValid) {
      return { success: false, message: "Invalid license" };
    }

    return await createEbookWindow();
  } catch (error) {
    console.error("❌ Launch ebook error:", error);
    return { success: false, message: error.message };
  }
});

// Get system info
ipcMain.handle("get-system-info", async () => {
  try {
    const os = require("os");
    return {
      success: true,
      data: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        username: os.userInfo().username,
        appVersion: app.getVersion(),
      },
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Log usage
ipcMain.handle("log-usage", async (event, usageData) => {
  try {
    return await license.logUsage(usageData);
  } catch (error) {
    console.error("❌ Usage logging error:", error);
    return { success: false, message: error.message };
  }
});

// Close app
ipcMain.handle("close-app", async () => {
  try {
    // Log app close
    await license.logUsage({
      action: "app_closed",
      sessionEnd: new Date().toISOString(),
    });

    app.quit();
    return { success: true };
  } catch (error) {
    app.quit();
    return { success: true };
  }
});

// Show message dialog
ipcMain.handle("show-message", async (event, options) => {
  try {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
  } catch (error) {
    return { response: 0 };
  }
});

// Open external URL
ipcMain.handle("open-external", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle("navigate-to-info", async () => {
  try {
    console.log("📖 Navigating to info page...");
    mainWindow.loadFile("app/info.html");
    return { success: true };
  } catch (error) {
    console.error("❌ Error navigating to info:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle("navigate-to-dashboard", async () => {
  try {
    console.log("📊 Navigating to dashboard...");
    mainWindow.loadFile("app/dashboard.html");
    return { success: true };
  } catch (error) {
    console.error("❌ Error navigating to dashboard:", error);
    return { success: false, message: error.message };
  }
});

// Navigate to activation page
ipcMain.handle("navigate-to-activation", async () => {
  try {
    console.log("🔑 Navigating to activation page...");
    mainWindow.loadFile("app/activation.html");
    return { success: true };
  } catch (error) {
    console.error("❌ Error navigating to activation:", error);
    return { success: false, message: error.message };
  }
});

// === APP EVENTS ===

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Prevent navigation to external URLs
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (navigationEvent, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== "file://") {
      navigationEvent.preventDefault();
    }
  });
});
