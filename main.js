const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Import modules
const SimpleLicense = require("./src/SimpleLicense");
const SimpleDecryptor = require("./src/SimpleDecryptor");

let mainWindow;
let ebookWindow;
let license;
let sessionId; // Track current session
let sessionStartTime;

app.whenReady().then(async () => {
  console.log("✅ App ready");

  // Initialize license
  license = new SimpleLicense();

  // Start session tracking
  sessionId = generateSessionId();
  sessionStartTime = new Date();

  await createWindow();

  // Log app start
  await logAppUsage("app_start");
});

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Check license
  const isValid = await license.isValid();

  if (isValid) {
    loadDashboard();
  } else {
    loadActivationPage();
  }

  // Window events
  mainWindow.on("closed", async () => {
    await logAppUsage("app_close");
  });
}

function loadActivationPage() {
  mainWindow.loadFile("app/activation.html");
}

function loadDashboard() {
  mainWindow.loadFile("app/dashboard.html");
}

// === IPC HANDLERS ===

// Activate license
ipcMain.handle("activate-license", async (event, licenseKey) => {
  const result = await license.activate(licenseKey);

  if (result.success) {
    // Log successful activation
    await logAppUsage("license_activated", null, {
      license_type: result.data?.type,
    });

    setTimeout(() => loadDashboard(), 2000);
  }

  return result;
});

// Get license info
ipcMain.handle("get-activation-info", async () => {
  return await license.getLicenseInfo();
});

// Reset license
ipcMain.handle("reset-activation", async () => {
  await logAppUsage("license_reset");
  const result = await license.reset();
  loadActivationPage();
  return result;
});

// Launch ebook
ipcMain.handle("launch-ebook-internal", async () => {
  const isValid = await license.isValid();

  if (!isValid) {
    return { success: false, message: "No valid license" };
  }

  try {
    // Log ebook launch
    await logAppUsage("ebook_launched");

    // Create ebook window (existing logic)
    if (ebookWindow && !ebookWindow.isDestroyed()) {
      ebookWindow.focus();
      return { success: true, message: "Ebook window focused" };
    }

    // Check if encrypted flipbook is available
    const simpleDecryptor = new SimpleDecryptor();
    if (!simpleDecryptor.isAvailable()) {
      throw new Error("Encrypted flipbook not found");
    }

    const indexPath = await simpleDecryptor.decryptFlipbook();
    if (!indexPath) {
      throw new Error("Failed to decrypt flipbook");
    }

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
        webSecurity: false,
      },
      autoHideMenuBar: true,
    });

    await ebookWindow.loadFile(indexPath);

    // Track ebook usage
    let pagesViewed = 0;
    let timeSpentReading = Date.now();

    ebookWindow.webContents.on("did-finish-load", async () => {
      await logAppUsage("ebook_opened");
    });

    ebookWindow.on("closed", async () => {
      const readingDuration = Math.floor(
        (Date.now() - timeSpentReading) / 1000
      );

      await logAppUsage("ebook_closed", null, {
        pages_viewed: pagesViewed,
        reading_duration: readingDuration,
      });

      if (simpleDecryptor) {
        simpleDecryptor.cleanup();
      }
      ebookWindow = null;
    });

    return { success: true, message: "Ebook launched successfully" };
  } catch (error) {
    console.error("❌ Error launching ebook:", error);
    await logAppUsage("ebook_launch_failed", null, { error: error.message });
    return { success: false, message: error.message };
  }
});

// Check feature availability
ipcMain.handle("check-feature", async (event, featureName) => {
  try {
    const licenseInfo = await license.getLicenseInfo();
    const hasFeature = licenseInfo.features.includes(featureName);

    if (hasFeature) {
      await logAppUsage("feature_checked", featureName);
    }

    return {
      hasFeature: hasFeature,
      licenseType: licenseInfo.type,
    };
  } catch (error) {
    return { hasFeature: false, licenseType: "none" };
  }
});

// Log feature usage
ipcMain.handle("log-feature-usage", async (event, featureName, data = {}) => {
  await logAppUsage("feature_used", featureName, data);
  return { success: true };
});

// Get usage stats
ipcMain.handle("get-usage-stats", async () => {
  const sessionDuration = Math.floor((new Date() - sessionStartTime) / 1000);

  return {
    sessionId: sessionId,
    sessionDuration: sessionDuration,
    sessionStart: sessionStartTime.toISOString(),
  };
});

// Close app
ipcMain.handle("close-app", async () => {
  await logAppUsage("app_close");
  app.quit();
});

// === USAGE TRACKING ===

async function logAppUsage(action, feature = null, additionalData = {}) {
  try {
    const usageData = {
      sessionId: sessionId,
      action: action,
      feature: feature,
      sessionStart: sessionStartTime.toISOString(),
      ...additionalData,
    };

    // Add session end time for closing actions
    if (action.includes("close") || action.includes("exit")) {
      usageData.sessionEnd = new Date().toISOString();
      usageData.duration = Math.floor((new Date() - sessionStartTime) / 1000);
    }

    await license.logUsage(usageData);
    console.log(`📊 Logged usage: ${action}${feature ? " - " + feature : ""}`);
  } catch (error) {
    console.warn("Failed to log usage:", error.message);
  }
}

function generateSessionId() {
  return (
    "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  );
}

// App events
app.on("window-all-closed", async () => {
  await logAppUsage("all_windows_closed");

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await logAppUsage("app_before_quit");
});

console.log("📝 Enhanced license system with usage tracking ready");
