// src/SimpleDecryptor.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SimpleDecryptor {
  constructor() {
    this.secretKey = 'EBOOK-SECRET-KEY-2025'; // Same as encryptor
    this.isProduction = app.isPackaged;
    
    // Paths
    if (this.isProduction) {
      this.encryptedDir = path.join(process.resourcesPath, 'flipbook-encrypted');
    } else {
      this.encryptedDir = path.join(__dirname, '..', 'assets', 'flipbook-encrypted');
    }
    
    this.tempDir = path.join(app.getPath('temp'), 'ebook-decrypted-' + Date.now());
    this.isReady = false;
  }

  // Simple XOR decryption (same as encryption)
  decrypt(data, key) {
    let result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key.charCodeAt(i % key.length);
    }
    return result;
  }

  // Check if encrypted flipbook exists
  isAvailable() {
    const manifestPath = path.join(this.encryptedDir, 'manifest.json');
    return fs.existsSync(manifestPath);
  }

  // Decrypt single file
  decryptFile(encryptedPath, outputPath) {
    try {
      const encryptedData = fs.readFileSync(encryptedPath);
      const decrypted = this.decrypt(encryptedData, this.secretKey);
      
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, decrypted);
      return true;
    } catch (error) {
      console.error(`❌ Error decrypting ${encryptedPath}:`, error.message);
      return false;
    }
  }

  // Walk directory recursively
  walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.walkDir(filePath, callback);
      } else {
        callback(filePath);
      }
    });
  }

  // Decrypt entire flipbook to temp directory
  async decryptFlipbook() {
    try {
      console.log('🔓 Starting flipbook decryption...');
      
      if (!this.isAvailable()) {
        throw new Error('Encrypted flipbook not found');
      }

      // Create temp directory
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }

      let fileCount = 0;
      let decryptedCount = 0;

      // Decrypt all .enc files
      this.walkDir(this.encryptedDir, (filePath) => {
        if (!filePath.endsWith('.enc')) return; // Skip manifest.json
        
        fileCount++;
        
        // Get relative path and remove .enc extension
        const relativePath = path.relative(this.encryptedDir, filePath);
        const originalPath = relativePath.replace('.enc', '');
        const outputPath = path.join(this.tempDir, originalPath);
        
        if (this.decryptFile(filePath, outputPath)) {
          decryptedCount++;
        }
      });

      console.log(`✅ Decryption complete: ${decryptedCount}/${fileCount} files`);
      
      // Check if index.html exists
      const indexPath = path.join(this.tempDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        this.isReady = true;
        return indexPath;
      } else {
        throw new Error('index.html not found after decryption');
      }
      
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      return null;
    }
  }

  // Get flipbook path
  getFlipbookPath() {
    if (!this.isReady) return null;
    return path.join(this.tempDir, 'index.html');
  }

  // Cleanup temp files
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
        console.log('🗑️ Temp files cleaned up');
      }
    } catch (error) {
      console.warn('Warning: Could not cleanup temp files:', error.message);
    }
  }
}

module.exports = SimpleDecryptor;
