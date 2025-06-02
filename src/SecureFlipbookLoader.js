const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app, protocol } = require("electron");

class SecureFlipbookLoader {
  constructor() {
    this.masterKey = "EBOOK-MASTER-KEY-2025-SECURE"; // Same as encryptor
    this.algorithm = "aes-256-cbc";
    this.isProduction = app.isPackaged;

    // Paths
    if (this.isProduction) {
      this.encryptedDir = path.join(
        process.resourcesPath,
        "flipbook-encrypted"
      );
    } else {
      this.encryptedDir = path.join(
        __dirname,
        "..",
        "assets",
        "flipbook-encrypted"
      );
    }

    this.tempDir = path.join(app.getPath("temp"), "ebook-secure-" + Date.now());
    this.manifest = null;
    this.decryptionKey = null;
    this.isInitialized = false;
  }

  // Initialize with license info
  async initialize(licenseKey, deviceFingerprint) {
    try {
      console.log("🔐 Initializing secure flipbook loader...");

      // Generate decryption key
      this.decryptionKey = this.generateDecryptionKey(
        licenseKey,
        deviceFingerprint
      );

      // Load manifest
      await this.loadManifest();

      // Create secure protocol
      this.setupSecureProtocol();

      // Create temp directory
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }

      this.isInitialized = true;
      console.log("✅ Secure flipbook loader initialized");

      return { success: true };
    } catch (error) {
      console.error("❌ Failed to initialize secure loader:", error);
      return { success: false, error: error.message };
    }
  }

  // Generate decryption key from license + device
  generateDecryptionKey(licenseKey, deviceFingerprint) {
    const combined = this.masterKey + licenseKey + deviceFingerprint;
    return crypto.scryptSync(combined, "salt-decrypt-2025", 32);
  }

  // Load encryption manifest
  async loadManifest() {
    const manifestPath = path.join(this.encryptedDir, "manifest.json");

    if (!fs.existsSync(manifestPath)) {
      throw new Error("Encryption manifest not found");
    }

    const manifestData = fs.readFileSync(manifestPath, "utf8");
    this.manifest = JSON.parse(manifestData);

    console.log(
      `📋 Loaded manifest: ${this.manifest.files.length} encrypted files`
    );
  }

  // Decrypt single file
  decryptFile(encryptedPath) {
    try {
      if (!fs.existsSync(encryptedPath)) {
        console.error(`❌ Encrypted file not found: ${encryptedPath}`);
        return null;
      }

      const encryptedData = fs.readFileSync(encryptedPath);

      // Extract IV and encrypted content
      const iv = encryptedData.slice(0, 16);
      const encrypted = encryptedData.slice(16);

      const decipher = crypto.createDecipher(
        this.algorithm,
        this.decryptionKey
      );
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      console.error(`❌ Error decrypting file:`, error.message);
      return null;
    }
  }

  // Setup secure protocol for serving decrypted files
  setupSecureProtocol() {
    protocol.registerBufferProtocol("secure-ebook", (request, callback) => {
      try {
        const url = request.url.replace("secure-ebook://", "");
        const filePath = this.getEncryptedFilePath(url);

        if (!filePath) {
          callback({ error: -6 }); // File not found
          return;
        }

        const decryptedData = this.decryptFile(filePath);

        if (!decryptedData) {
          callback({ error: -6 });
          return;
        }

        // Determine MIME type
        const mimeType = this.getMimeType(url);

        callback({
          data: decryptedData,
          mimeType: mimeType,
        });
      } catch (error) {
        console.error("Protocol error:", error);
        callback({ error: -2 });
      }
    });
  }

  // Get encrypted file path from original path
  getEncryptedFilePath(originalPath) {
    if (!this.manifest) return null;

    const fileInfo = this.manifest.files.find(
      (f) => f.original === originalPath
    );
    if (!fileInfo) return null;

    return path.join(this.encryptedDir, fileInfo.encrypted);
  }

  // Get MIME type for file
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".mp4": "video/mp4",
      ".mp3": "audio/mpeg",
    };

    return mimeTypes[ext] || "application/octet-stream";
  }

  // Get secure URL for flipbook
  getSecureFlipbookUrl() {
    if (!this.isInitialized) {
      throw new Error("Secure loader not initialized");
    }

    return "secure-ebook://index.html";
  }

  // Decrypt and save file to temp (for cases where protocol doesn't work)
  async decryptToTemp(originalPath) {
    try {
      const encryptedPath = this.getEncryptedFilePath(originalPath);
      if (!encryptedPath) {
        throw new Error(`File not found: ${originalPath}`);
      }

      const decryptedData = this.decryptFile(encryptedPath);
      if (!decryptedData) {
        throw new Error(`Failed to decrypt: ${originalPath}`);
      }

      const tempFilePath = path.join(this.tempDir, originalPath);
      const tempFileDir = path.dirname(tempFilePath);

      // Ensure directory exists
      if (!fs.existsSync(tempFileDir)) {
        fs.mkdirSync(tempFileDir, { recursive: true });
      }

      fs.writeFileSync(tempFilePath, decryptedData);
      return tempFilePath;
    } catch (error) {
      console.error(`❌ Error decrypting to temp:`, error);
      return null;
    }
  }

  // Decrypt entire flipbook to temp directory
  async decryptFlipbookToTemp() {
    try {
      console.log("🔓 Decrypting flipbook to temp directory...");

      if (!this.manifest) {
        throw new Error("Manifest not loaded");
      }

      let decryptedCount = 0;

      for (const fileInfo of this.manifest.files) {
        const tempPath = await this.decryptToTemp(fileInfo.original);
        if (tempPath) {
          decryptedCount++;
        }
      }

      console.log(
        `✅ Decrypted ${decryptedCount}/${this.manifest.files.length} files to temp`
      );

      const indexPath = path.join(this.tempDir, "index.html");
      if (fs.existsSync(indexPath)) {
        return indexPath;
      } else {
        throw new Error("index.html not found after decryption");
      }
    } catch (error) {
      console.error("❌ Error decrypting flipbook:", error);
      return null;
    }
  }

  // Cleanup temp files
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
        console.log("🗑️ Temp files cleaned up");
      }
    } catch (error) {
      console.warn("Warning: Could not cleanup temp files:", error.message);
    }
  }

  // Check if flipbook is available
  isFlipbookAvailable() {
    const manifestPath = path.join(this.encryptedDir, "manifest.json");
    return fs.existsSync(manifestPath);
  }

  // Get flipbook info
  getFlipbookInfo() {
    if (!this.manifest) return null;

    return {
      fileCount: this.manifest.files.length,
      version: this.manifest.version,
      created: this.manifest.created_at,
      encrypted: this.manifest.encrypted,
    };
  }
}

module.exports = SecureFlipbookLoader;
