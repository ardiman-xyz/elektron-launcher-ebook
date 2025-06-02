// src/SimpleLicense.js
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { app } = require("electron");

class SimpleLicense {
  constructor() {
    this.licenseFile = path.join(app.getPath("userData"), "license.json");
    this.apiUrl = process.env.LICENSE_API_URL || "http://localhost:8001/api"; // Laravel API URL
  }

  // Aktivasi license - panggil API Laravel
  async activate(licenseKey) {
    try {
      console.log("🔑 Activating license:", licenseKey);

      // 1. Get device info
      const deviceId = this.getDeviceId();

      // 2. Call Laravel API
      const response = await this.callAPI("/license/activate", {
        license_key: licenseKey,
        device_id: deviceId,
      });

      if (response.success) {
        // 3. Save license locally
        await this.saveLicense({
          licenseKey: licenseKey,
          type: response.data.type,
          expiresAt: response.data.expires_at,
          features: response.data.features,
          deviceId: deviceId,
          activatedAt: new Date().toISOString(),
        });

        return { success: true, message: "License activated!" };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error("Activation failed:", error);
      return { success: false, message: "Activation failed: " + error.message };
    }
  }

  // Check apakah license valid
  async isValid() {
    try {
      const license = await this.loadLicense();
      if (!license) return false;

      // Check expiry
      if (new Date() > new Date(license.expiresAt)) {
        return false;
      }

      // Check device
      if (license.deviceId !== this.getDeviceId()) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Get current license info
  async getLicenseInfo() {
    try {
      const license = await this.loadLicense();
      const isValidLicense = await this.isValid();

      return {
        isActivated: isValidLicense,
        type: license?.type || "none",
        licenseKey: license?.licenseKey ? this.maskKey(license.licenseKey) : "",
        expiresAt: license?.expiresAt || "",
        features: license?.features || [],
      };
    } catch (error) {
      return { isActivated: false, type: "none" };
    }
  }

  // Reset license
  async reset() {
    try {
      await fs.unlink(this.licenseFile);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // === HELPER FUNCTIONS ===

  // Save license to file
  async saveLicense(licenseData) {
    await fs.writeFile(this.licenseFile, JSON.stringify(licenseData, null, 2));
  }

  // Load license from file
  async loadLicense() {
    try {
      const data = await fs.readFile(this.licenseFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  // Get simple device ID
  getDeviceId() {
    const os = require("os");
    const deviceInfo = os.hostname() + os.platform() + os.arch();
    return crypto.createHash("sha256").update(deviceInfo).digest("hex");
  }

  // Mask license key for display
  maskKey(key) {
    return key.substring(0, 9) + "****";
  }

  // Call Laravel API
  async callAPI(endpoint, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const url = new URL(this.apiUrl + endpoint);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let responseData = "";
        res.on("data", (chunk) => {
          responseData += chunk;
        });
        res.on("end", () => {
          try {
            const jsonResponse = JSON.parse(responseData);
            resolve(jsonResponse);
          } catch (error) {
            reject(new Error("Invalid JSON response"));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }
}

module.exports = SimpleLicense;
