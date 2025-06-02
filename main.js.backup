const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Import backend modules
const ActivationManager = require("./src/activation");
const DeviceManager = require("./src/device");

console.log("🚀 Starting E-book Launcher...");

let mainWindow;
let ebookWindow;
let activationManager;
let deviceManager;

app.whenReady().then(async () => {
  console.log("✅ App ready");

  // Initialize backend
  activationManager = new ActivationManager();
  deviceManager = new DeviceManager();

  await createWindow();
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

  // Check activation and load appropriate page
  const isActivated = await activationManager.checkActivation();

  if (isActivated) {
    loadDashboard();
  } else {
    loadActivationPage();
  }

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
}

function loadActivationPage() {
  console.log("📄 Loading activation page...");
  mainWindow.loadFile("app/activation.html");
}

function loadDashboard() {
  console.log("📊 Loading dashboard...");
  mainWindow.loadFile("app/dashboard.html");
}

async function createEbookWindow() {
  try {
    console.log("📖 Starting e-book window creation...");

    if (ebookWindow && !ebookWindow.isDestroyed()) {
      console.log("👁️ E-book window already exists, focusing...");
      ebookWindow.focus();
      return;
    }

    const flipbookPath = path.join(
      __dirname,
      "assets",
      "flipbook",
      "index.html"
    );
    console.log("📁 Checking flipbook path:", flipbookPath);

    if (!require("fs").existsSync(flipbookPath)) {
      console.error("❌ Flipbook not found at:", flipbookPath);
      throw new Error("E-book content not found at: " + flipbookPath);
    }

    console.log("✅ Flipbook found, creating window...");

    ebookWindow = new BrowserWindow({
      width: 1200,
      height: 850,
      minWidth: 900,
      minHeight: 700,
      title: "📚 E-book Viewer",
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
      autoHideMenuBar: true,
    });

    console.log("🖼️ Window created, loading flipbook...");
    await ebookWindow.loadFile(flipbookPath);
    console.log("📄 Flipbook loaded successfully");

    ebookWindow.on("closed", () => {
      ebookWindow = null;
      console.log("📖 E-book window closed");
    });

    setTimeout(() => {
      if (ebookWindow && !ebookWindow.isDestroyed()) {
        ebookWindow.webContents
          .executeJavaScript(
            `
                    const indicator = document.createElement("div");
                    indicator.innerHTML = "📚 Protected E-book";
                    indicator.style.cssText = "position: fixed; top: 10px; right: 10px; background: rgba(40, 167, 69, 0.9); color: white; padding: 8px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; z-index: 999999; font-family: Arial, sans-serif;";
                    document.body.appendChild(indicator);
                `
          )
          .catch((err) => console.log("Security injection error:", err));
      }
    }, 2000);

    console.log("✅ E-book window setup completed");
  } catch (error) {
    console.error("❌ Error creating e-book window:", error);
    throw error;
  }
}

// IPC Handlers
ipcMain.handle("activate-license", async (event, licenseKey) => {
  console.log("🔑 Processing activation...");

  try {
    const deviceFingerprint = await deviceManager.getDeviceFingerprint();
    const result = await activationManager.activateLicense(
      licenseKey,
      deviceFingerprint
    );

    if (result.success) {
      setTimeout(() => loadDashboard(), 2000);
    }

    return result;
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle("get-activation-info", async () => {
  return await activationManager.getActivationData();
});

ipcMain.handle("reset-activation", async () => {
  const result = await activationManager.resetActivation();
  loadActivationPage();
  return result;
});

ipcMain.handle("close-app", () => {
  app.quit();
});

// E-book launch handlers
ipcMain.handle("launch-ebook-internal", async () => {
  try {
    console.log("🏠 Launching internal e-book window...");
    await createEbookWindow();
    return { success: true, message: "E-book opened in internal window" };
  } catch (error) {
    console.error("❌ Error launching internal e-book:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle("close-ebook-window", () => {
  if (ebookWindow && !ebookWindow.isDestroyed()) {
    ebookWindow.close();
    ebookWindow = null;
    return { success: true };
  }
  return { success: false, message: "No e-book window to close" };
});

ipcMain.handle("get-activation-path", async () => {
  return {
    activationFile: activationManager.activationFile,
    userDataPath: app.getPath("userData"),
  };
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

console.log("📝 Main process ready with internal e-book launcher");

// Browser launch handler
ipcMain.handle("launch-ebook-browser", async () => {
  try {
    console.log("🌐 Launching e-book in browser...");

    const flipbookPath = path.join(
      __dirname,
      "assets",
      "flipbook",
      "index.html"
    );

    if (!require("fs").existsSync(flipbookPath)) {
      throw new Error("E-book content not found");
    }

    // Open in default browser
    const { shell } = require("electron");
    await shell.openPath(flipbookPath);

    console.log("✅ E-book opened in browser");
    return { success: true, message: "E-book opened in default browser" };
  } catch (error) {
    console.error("❌ Error launching browser e-book:", error);
    return { success: false, message: error.message };
  }
});
