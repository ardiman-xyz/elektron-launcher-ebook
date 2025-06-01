const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

class Utils {
  constructor() {
    this.tempDirs = new Set();
    this.cleanupInterval = null;
    this.startPeriodicCleanup();
  }

  async createTempDir(prefix = "ebook") {
    const tempDir = path.join(
      os.tmpdir(),
      `${prefix}_${Date.now()}_${uuidv4().substring(0, 8)}`
    );

    try {
      await fs.ensureDir(tempDir);
      this.tempDirs.add(tempDir);

      console.log(`📁 Created temp directory: ${tempDir}`);
      return tempDir;
    } catch (error) {
      console.error("Error creating temp directory:", error);
      throw new Error(`Failed to create temp directory: ${error.message}`);
    }
  }

  async cleanupTempDir(tempDir) {
    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
        this.tempDirs.delete(tempDir);
        console.log(`🗑️ Cleaned up temp directory: ${tempDir}`);
      }
      return { success: true };
    } catch (error) {
      console.error("Error cleaning up temp directory:", error);
      return { success: false, message: error.message };
    }
  }

  async cleanupAllTempDirs() {
    console.log(`🧹 Cleaning up ${this.tempDirs.size} temp directories...`);

    const cleanupPromises = Array.from(this.tempDirs).map((dir) =>
      this.cleanupTempDir(dir)
    );

    const results = await Promise.all(cleanupPromises);
    this.tempDirs.clear();

    const successful = results.filter((r) => r.success).length;
    console.log(
      `✅ Cleaned up ${successful}/${results.length} temp directories`
    );

    return { successful, total: results.length };
  }

  startPeriodicCleanup() {
    // Clean up old temp directories every 30 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldTempDirs();
    }, 30 * 60 * 1000);
  }

  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async cleanupOldTempDirs() {
    try {
      const tempBase = os.tmpdir();
      const entries = await fs.readdir(tempBase);

      const ebookTempDirs = entries.filter(
        (entry) => entry.startsWith("ebook_") && entry.includes("_")
      );

      let cleaned = 0;
      for (const dirName of ebookTempDirs) {
        const dirPath = path.join(tempBase, dirName);

        try {
          const stats = await fs.stat(dirPath);
          const age = Date.now() - stats.mtime.getTime();

          // Remove directories older than 2 hours
          if (age > 2 * 60 * 60 * 1000) {
            await fs.remove(dirPath);
            this.tempDirs.delete(dirPath);
            cleaned++;
          }
        } catch (error) {
          // Ignore errors for individual directories
          console.warn(
            `Warning: Could not clean old temp dir ${dirPath}:`,
            error.message
          );
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} old temp directories`);
      }
    } catch (error) {
      console.warn(
        "Warning: Could not perform periodic cleanup:",
        error.message
      );
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  async getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.warn("Error calculating directory size:", error);
      return 0;
    }
  }

  generateSecureToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  generateSessionKey() {
    return uuidv4();
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[^a-z0-9.-]/gi, "_")
      .replace(/_{2,}/g, "_")
      .toLowerCase();
  }

  async copyDirectory(source, destination) {
    try {
      await fs.copy(source, destination, {
        overwrite: true,
        errorOnExist: false,
      });
      return { success: true };
    } catch (error) {
      console.error("Error copying directory:", error);
      return { success: false, message: error.message };
    }
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return { success: true };
    } catch (error) {
      console.error("Error ensuring directory:", error);
      return { success: false, message: error.message };
    }
  }

  async fileExists(filePath) {
    try {
      return await fs.pathExists(filePath);
    } catch (error) {
      return false;
    }
  }

  async readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error("Error reading JSON file:", error);
      return null;
    }
  }

  async writeJsonFile(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return { success: true };
    } catch (error) {
      console.error("Error writing JSON file:", error);
      return { success: false, message: error.message };
    }
  }

  // Get app version from package.json
  getAppVersion() {
    try {
      const packageJson = require("../package.json");
      return packageJson.version;
    } catch (error) {
      return "1.0.0";
    }
  }

  // Get platform-specific paths
  getPlatformPaths() {
    const platform = process.platform;
    const homeDir = os.homedir();

    const paths = {
      home: homeDir,
      temp: os.tmpdir(),
      platform: platform,
    };

    switch (platform) {
      case "win32":
        paths.appData =
          process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
        paths.localAppData =
          process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
        break;
      case "darwin":
        paths.appData = path.join(homeDir, "Library", "Application Support");
        paths.localAppData = paths.appData;
        break;
      case "linux":
        paths.appData =
          process.env.XDG_CONFIG_HOME || path.join(homeDir, ".config");
        paths.localAppData =
          process.env.XDG_DATA_HOME || path.join(homeDir, ".local", "share");
        break;
      default:
        paths.appData = path.join(homeDir, ".config");
        paths.localAppData = path.join(homeDir, ".local", "share");
    }

    return paths;
  }

  // Log activity with timestamp
  log(message, level = "info") {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case "error":
        console.error(logMessage);
        break;
      case "warn":
        console.warn(logMessage);
        break;
      case "debug":
        if (process.env.NODE_ENV === "development") {
          console.log(logMessage);
        }
        break;
      default:
        console.log(logMessage);
    }
  }

  // Validate license key format
  validateLicenseFormat(licenseKey) {
    const licenseRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return licenseRegex.test(licenseKey);
  }

  // Format license key
  formatLicenseKey(input) {
    // Remove non-alphanumeric characters and convert to uppercase
    const clean = input.replace(/[^A-Z0-9]/g, "").toUpperCase();

    // Add hyphens every 4 characters
    const formatted = clean.match(/.{1,4}/g)?.join("-") || clean;

    // Limit to 19 characters (XXXX-XXXX-XXXX-XXXX)
    return formatted.substring(0, 19);
  }

  // Cleanup on app exit
  async onAppExit() {
    this.stopPeriodicCleanup();
    await this.cleanupAllTempDirs();
  }
}

module.exports = Utils;
