// src/SimpleLicense.js
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { app } = require("electron");
const os = require("os");

class SimpleLicense {
  constructor() {
    this.licenseFile = path.join(app.getPath("userData"), "license.json");
    this.apiUrl = process.env.LICENSE_API_URL || "http://127.0.0.1:8001/api"; // Laravel API URL
  }

  // Aktivasi license - panggil API Laravel
  async activate(licenseKey) {
    try {
      console.log("🔑 Activating license:", licenseKey);

      // 1. Get comprehensive device info
      const deviceInfo = this.getDeviceInfo();

      // 2. Call Laravel API
      const response = await this.callAPI("/license/activate", {
        license_key: licenseKey,
        device_id: deviceInfo.device_id,
        device_name: deviceInfo.device_name,
        platform: deviceInfo.platform,
        arch: deviceInfo.arch,
        hostname: deviceInfo.hostname,
        username: deviceInfo.username,
        app_version: deviceInfo.app_version,
      });

      if (response.success) {
        // 3. Save license locally
        await this.saveLicense({
          licenseKey: licenseKey,
          type: response.data.type,
          expiresAt: response.data.expires_at,
          features: response.data.features,
          restrictions: response.data.restrictions,
          maxDevices: response.data.max_devices,
          devicesUsed: response.data.devices_used,
          isLifetime: response.data.is_lifetime,
          deviceId: deviceInfo.device_id,
          activatedAt: new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        });

        console.log("✅ License activated successfully");
        return {
          success: true,
          message: "License activated successfully!",
          data: response.data,
        };
      } else {
        console.error("❌ License activation failed:", response.message);
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("💥 Activation failed:", error);
      return {
        success: false,
        message: "Activation failed: " + error.message,
      };
    }
  }

  // Verify license dengan server
  async verify() {
    try {
      const license = await this.loadLicense();
      if (!license) return { success: false, message: "No license found" };

      console.log("🔍 Verifying license with server...");

      const response = await this.callAPI("/license/verify", {
        license_key: license.licenseKey,
        device_id: license.deviceId,
      });

      if (response.success) {
        // Update local license dengan data terbaru
        license.lastVerified = new Date().toISOString();
        license.features = response.data.features;
        license.restrictions = response.data.restrictions;
        license.expiresAt = response.data.expires_at;

        await this.saveLicense(license);

        console.log("✅ License verified successfully");
        return { success: true, data: response.data };
      } else {
        console.error("❌ License verification failed:", response.message);
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("💥 Verification failed:", error);
      return {
        success: false,
        message: "Verification failed: " + error.message,
      };
    }
  }

  // Check apakah license valid (offline check)
  async isValid() {
    try {
      const license = await this.loadLicense();
      if (!license) {
        console.log("ℹ️ No license file found");
        return false;
      }

      // Check expiry (jika bukan lifetime)
      if (!license.isLifetime && license.expiresAt) {
        if (new Date() > new Date(license.expiresAt)) {
          console.log("⏰ License expired");
          return false;
        }
      }

      // Check device
      const currentDeviceId = this.getDeviceInfo().device_id;
      if (license.deviceId !== currentDeviceId) {
        console.log("🖥️ Device mismatch");
        return false;
      }

      console.log("✅ License is valid (offline check)");
      return true;
    } catch (error) {
      console.error("❌ License validation error:", error);
      return false;
    }
  }

  // Get current license info
  async getLicenseInfo() {
    try {
      const license = await this.loadLicense();
      const isValidLicense = await this.isValid();

      if (!license) {
        return {
          isActivated: false,
          type: "none",
          licenseKey: "",
          platform: this.getDeviceInfo().platform,
        };
      }

      return {
        isActivated: isValidLicense,
        type: license.type || "none",
        licenseKey: license.licenseKey,
        maskedKey: license.licenseKey ? this.maskKey(license.licenseKey) : "",
        expiresAt: license.expiresAt || "",
        features: license.features || [],
        restrictions: license.restrictions || {},
        isLifetime: license.isLifetime || false,
        maxDevices: license.maxDevices || 1,
        devicesUsed: license.devicesUsed || 0,
        activatedAt: license.activatedAt || "",
        lastVerified: license.lastVerified || "",
        platform: this.getDeviceInfo().platform,
        deviceName: this.getDeviceInfo().device_name,
      };
    } catch (error) {
      console.error("❌ Error getting license info:", error);
      return {
        isActivated: false,
        type: "none",
        platform: this.getDeviceInfo().platform,
      };
    }
  }

  // Deactivate license
  async deactivate() {
    try {
      const license = await this.loadLicense();
      if (!license) {
        return { success: false, message: "No license to deactivate" };
      }

      console.log("🔓 Deactivating license...");

      const response = await this.callAPI("/license/deactivate", {
        license_key: license.licenseKey,
        device_id: license.deviceId,
      });

      if (response.success) {
        await this.reset();
        console.log("✅ License deactivated successfully");
        return { success: true, message: "License deactivated successfully" };
      } else {
        console.error("❌ License deactivation failed:", response.message);
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("💥 Deactivation failed:", error);
      return {
        success: false,
        message: "Deactivation failed: " + error.message,
      };
    }
  }

  // Reset license (remove local file)
  async reset() {
    try {
      await fs.unlink(this.licenseFile);
      console.log("🗑️ License file removed");
      return { success: true };
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist, that's fine
        return { success: true };
      }
      console.error("❌ Error removing license file:", error);
      return { success: false, message: error.message };
    }
  }

  // Log usage to server
  async logUsage(usageData) {
    try {
      const license = await this.loadLicense();
      if (!license) return { success: false, message: "No license found" };

      const response = await this.callAPI("/license/usage", {
        license_key: license.licenseKey,
        device_id: license.deviceId,
        session_id: usageData.sessionId || this.generateSessionId(),
        action: usageData.action || "app_usage",
        feature_used: usageData.feature,
        session_start: usageData.sessionStart,
        session_end: usageData.sessionEnd,
        session_duration: usageData.sessionDuration,
        pages_viewed: usageData.pagesViewed || 0,
        pages_printed: usageData.pagesPrinted || 0,
        pages_exported: usageData.pagesExported || 0,
        search_queries: usageData.searchQueries || 0,
        bookmarks_created: usageData.bookmarksCreated || 0,
        notes_created: usageData.notesCreated || 0,
        app_version: this.getDeviceInfo().app_version,
      });

      return response;
    } catch (error) {
      console.error("❌ Usage logging failed:", error);
      return { success: false, message: error.message };
    }
  }

  // === HELPER FUNCTIONS ===

  // Get comprehensive device info
  getDeviceInfo() {
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const username = os.userInfo().username;

    // Create unique device ID
    const deviceInfo = hostname + platform + arch + username;
    const deviceId = crypto
      .createHash("sha256")
      .update(deviceInfo)
      .digest("hex");

    return {
      device_id: deviceId,
      device_name: `${hostname} (${username})`,
      platform: platform,
      arch: arch,
      hostname: hostname,
      username: username,
      app_version: app.getVersion() || "1.0.0",
    };
  }

  // Save license to file
  async saveLicense(licenseData) {
    const dir = path.dirname(this.licenseFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.licenseFile, JSON.stringify(licenseData, null, 2));
    console.log("💾 License saved to:", this.licenseFile);
  }

  // Load license from file
  async loadLicense() {
    try {
      const data = await fs.readFile(this.licenseFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("❌ Error reading license file:", error);
      }
      return null;
    }
  }

  // Mask license key for display
  maskKey(key) {
    if (key.length > 10) {
      return key.substring(0, 9) + "****";
    }
    return key;
  }

  // Generate session ID
  generateSessionId() {
    return crypto.randomBytes(16).toString("hex");
  }

  // Call Laravel API
  async callAPI(endpoint, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const url = new URL(this.apiUrl + endpoint);

      // Determine if HTTP or HTTPS
      const isHttps = url.protocol === "https:";
      const client = isHttps ? https : http;
      const defaultPort = isHttps ? 443 : 80;

      const options = {
        hostname: url.hostname,
        port: url.port || defaultPort,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          "User-Agent": `EbookApp/${this.getDeviceInfo().app_version}`,
        },
        timeout: 10000, // 10 second timeout
      };

      console.log(`📡 API Call: ${options.method} ${this.apiUrl + endpoint}`);

      const req = client.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            console.log(
              `📡 API Response: ${res.statusCode} - ${responseData.substring(
                0,
                200
              )}...`
            );
            const jsonResponse = JSON.parse(responseData);
            resolve(jsonResponse);
          } catch (error) {
            console.error("❌ Invalid JSON response:", responseData);
            reject(new Error("Invalid JSON response from server"));
          }
        });
      });

      req.on("error", (error) => {
        console.error("❌ API Request error:", error);
        reject(new Error(`API request failed: ${error.message}`));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("API request timeout"));
      });

      req.write(postData);
      req.end();
    });
  }
}

module.exports = SimpleLicense;
