// src/AssetDownloader.js - Versi sederhana tanpa fs-extra
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const fetch = require("node-fetch");

class AssetDownloader {
  constructor() {
    // Direct download link dari Google Drive Anda
    this.downloadUrl =
      "https://drive.google.com/uc?export=download&id=1E3FfiOKe5qSWYDOekT08p62A_oK_uvVS";

    // Local paths
    this.userDataPath = app.getPath("userData");
    this.assetsPath = path.join(this.userDataPath, "ebook-assets");
    this.rarPath = path.join(this.userDataPath, "ebook-assets.rar");

    // Progress tracking
    this.isDownloading = false;
    this.progress = 0;
    this.status = "Ready";
  }

  async checkAssets() {
    console.log("🔍 Checking if assets exist...");

    const indexPath = path.join(this.assetsPath, "index.html");

    if (this.fileExists(indexPath)) {
      console.log("✅ Assets already exist");
      this.status = "Assets ready";
      return { success: true, fromCache: true };
    }

    console.log("📥 Assets not found, need to download");
    return await this.downloadAndExtract();
  }

  async downloadAndExtract() {
    try {
      this.isDownloading = true;
      this.progress = 0;
      this.status = "Starting download...";

      // Step 1: Download RAR
      await this.downloadRar();

      // Step 2: Extract RAR (manual extraction or use system command)
      this.status = "Extracting files...";
      this.progress = 80;
      await this.extractRar();

      // Step 3: Cleanup
      this.status = "Finishing up...";
      this.progress = 95;
      this.deleteFile(this.rarPath);

      // Step 4: Verify
      this.status = "Complete!";
      this.progress = 100;
      this.isDownloading = false;

      console.log("✅ Assets downloaded and extracted");
      return { success: true, fromCache: false };
    } catch (error) {
      console.error("❌ Download failed:", error);
      this.isDownloading = false;
      this.status = "Download failed";

      // Cleanup on error
      this.deleteFile(this.rarPath);
      this.deleteDirectory(this.assetsPath);

      return { success: false, error: error.message };
    }
  }

  async downloadRar() {
    console.log("📥 Downloading RAR file...");

    const response = await fetch(this.downloadUrl);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const totalSize = parseInt(response.headers.get("content-length") || "0");
    let downloadedSize = 0;

    // Ensure directory exists
    this.ensureDir(path.dirname(this.rarPath));

    // Create write stream
    const fileStream = fs.createWriteStream(this.rarPath);

    return new Promise((resolve, reject) => {
      response.body.on("data", (chunk) => {
        downloadedSize += chunk.length;

        if (totalSize > 0) {
          this.progress = Math.round((downloadedSize / totalSize) * 70); // 70% for download
          this.status = `Downloading... ${Math.round(
            downloadedSize / 1024 / 1024
          )}MB`;
        }
      });

      response.body.pipe(fileStream);

      fileStream.on("finish", () => {
        console.log("✅ RAR download complete");
        resolve();
      });

      fileStream.on("error", reject);
      response.body.on("error", reject);
    });
  }

  async extractRar() {
    console.log("📦 Extracting RAR file...");

    this.ensureDir(this.assetsPath);

    // Simple approach: use system unrar command
    const { exec } = require("child_process");

    return new Promise((resolve, reject) => {
      // Try different unrar commands based on system
      const commands = [
        `unrar x "${this.rarPath}" "${this.assetsPath}/"`,
        `7z x "${this.rarPath}" -o"${this.assetsPath}"`,
        `rar x "${this.rarPath}" "${this.assetsPath}/"`,
      ];

      let commandIndex = 0;

      const tryCommand = () => {
        if (commandIndex >= commands.length) {
          reject(
            new Error(
              "No suitable extraction tool found. Please install unrar or 7z."
            )
          );
          return;
        }

        const command = commands[commandIndex];
        console.log(`Trying: ${command}`);

        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.log(`Command failed: ${error.message}`);
            commandIndex++;
            tryCommand();
          } else {
            console.log("✅ RAR extraction complete");
            resolve();
          }
        });
      };

      tryCommand();
    });
  }

  getFlipbookPath() {
    // Return path to index.html in extracted folder
    const possiblePaths = [
      path.join(this.assetsPath, "index.html"),
      path.join(this.assetsPath, "Out3", "index.html"),
      path.join(this.assetsPath, "flipbook", "index.html"),
    ];

    for (const p of possiblePaths) {
      if (this.fileExists(p)) {
        return p;
      }
    }

    return path.join(this.assetsPath, "index.html");
  }

  getProgress() {
    return {
      isDownloading: this.isDownloading,
      progress: this.progress,
      status: this.status,
    };
  }

  // Helper functions using native fs
  fileExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  ensureDir(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      console.error("Error creating directory:", error);
    }
  }

  deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }

  deleteDirectory(dirPath) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error("Error deleting directory:", error);
    }
  }
}

module.exports = AssetDownloader;
