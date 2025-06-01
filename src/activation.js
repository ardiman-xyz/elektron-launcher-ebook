const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

class ActivationManager {
  constructor() {
    this.activationFile = path.join(app.getPath("userData"), "activation.json");
  }

  async activateLicense(licenseKey, deviceFingerprint) {
    console.log("🔑 Activating license:", licenseKey);

    // Validate license format
    if (!this.validateLicenseFormat(licenseKey)) {
      return { success: false, message: "Invalid license format" };
    }

    // Create activation data
    const activationData = {
      licenseKey,
      deviceFingerprint,
      activationToken: crypto.randomBytes(32).toString("hex"),
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      platform: process.platform,
    };

    try {
      // Save to file
      await fs.writeFile(
        this.activationFile,
        JSON.stringify(activationData, null, 2)
      );
      console.log("✅ Activation saved to:", this.activationFile);

      return {
        success: true,
        message: "License activated successfully",
        data: activationData,
      };
    } catch (error) {
      console.error("❌ Failed to save activation:", error);
      return {
        success: false,
        message: "Failed to save activation: " + error.message,
      };
    }
  }

  async checkActivation() {
    try {
      const data = await fs.readFile(this.activationFile, "utf8");
      const activationData = JSON.parse(data);

      // Check expiry
      if (new Date(activationData.expiresAt) < new Date()) {
        console.log("❌ Activation expired");
        return false;
      }

      console.log("✅ Activation valid");
      return true;
    } catch (error) {
      console.log("❌ No activation file found");
      return false;
    }
  }

  async getActivationData() {
    try {
      const data = await fs.readFile(this.activationFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async resetActivation() {
    try {
      await fs.unlink(this.activationFile);
      console.log("🔄 Activation reset");
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  validateLicenseFormat(licenseKey) {
    return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey);
  }
}

module.exports = ActivationManager;
