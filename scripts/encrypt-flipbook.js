const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class FlipbookEncryptor {
  constructor() {
    this.masterKey = "EBOOK-MASTER-KEY-2025-SECURE"; // Change this to your secret
    this.algorithm = "aes-256-cbc";
    this.inputDir = path.join(__dirname, "..", "assets", "flipbook");
    this.outputDir = path.join(__dirname, "..", "assets", "flipbook-encrypted");
  }

  // Generate encryption key dari master key
  generateKey() {
    return crypto.scryptSync(this.masterKey, "salt-ebook-2025", 32);
  }

  // Encrypt single file
  encryptFile(inputPath, outputPath) {
    try {
      const data = fs.readFileSync(inputPath);
      const key = this.generateKey();
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipher(this.algorithm, key);
      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Save IV + encrypted data
      const result = Buffer.concat([iv, encrypted]);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, result);
      console.log(`✅ Encrypted: ${path.basename(inputPath)}`);
    } catch (error) {
      console.error(`❌ Error encrypting ${inputPath}:`, error.message);
    }
  }

  // Decrypt single file
  decryptFile(encryptedPath, key) {
    try {
      const encryptedData = fs.readFileSync(encryptedPath);

      // Extract IV and encrypted content
      const iv = encryptedData.slice(0, 16);
      const encrypted = encryptedData.slice(16);

      const decipher = crypto.createDecipher(this.algorithm, key);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      console.error(`❌ Error decrypting ${encryptedPath}:`, error.message);
      return null;
    }
  }

  // Walk directory recursively
  walkDirectory(dir, callback) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.walkDirectory(filePath, callback);
      } else {
        callback(filePath);
      }
    });
  }

  // Encrypt entire flipbook directory
  encryptFlipbook() {
    console.log("🔐 Starting flipbook encryption...");

    if (!fs.existsSync(this.inputDir)) {
      console.error(`❌ Input directory not found: ${this.inputDir}`);
      return false;
    }

    // Clean output directory
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.outputDir, { recursive: true });

    let fileCount = 0;
    let encryptedCount = 0;

    this.walkDirectory(this.inputDir, (filePath) => {
      fileCount++;

      // Get relative path from input directory
      const relativePath = path.relative(this.inputDir, filePath);
      const outputPath = path.join(this.outputDir, relativePath + ".enc");

      this.encryptFile(filePath, outputPath);
      encryptedCount++;
    });

    console.log(
      `✅ Encryption complete! ${encryptedCount}/${fileCount} files encrypted`
    );
    console.log(`📁 Encrypted files saved to: ${this.outputDir}`);

    // Create encryption manifest
    this.createManifest();

    return true;
  }

  // Create manifest file for encrypted content
  createManifest() {
    const manifest = {
      version: "1.0.0",
      encrypted: true,
      algorithm: this.algorithm,
      created_at: new Date().toISOString(),
      files: [],
    };

    this.walkDirectory(this.outputDir, (filePath) => {
      const relativePath = path.relative(this.outputDir, filePath);
      const originalPath = relativePath.replace(".enc", "");

      manifest.files.push({
        original: originalPath,
        encrypted: relativePath,
        size: fs.statSync(filePath).size,
      });
    });

    const manifestPath = path.join(this.outputDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`📋 Manifest created: ${manifestPath}`);
  }

  // Generate decryption key based on license
  generateDecryptionKey(licenseKey, deviceFingerprint) {
    const combined = this.masterKey + licenseKey + deviceFingerprint;
    return crypto.scryptSync(combined, "salt-decrypt-2025", 32);
  }
}

// CLI usage
if (require.main === module) {
  const encryptor = new FlipbookEncryptor();

  const command = process.argv[2];

  if (command === "encrypt") {
    encryptor.encryptFlipbook();
  } else if (command === "test") {
    // Test encryption/decryption
    const testFile = process.argv[3];
    if (testFile && fs.existsSync(testFile)) {
      const outputFile = testFile + ".enc";
      encryptor.encryptFile(testFile, outputFile);

      const key = encryptor.generateKey();
      const decrypted = encryptor.decryptFile(outputFile, key);

      if (decrypted) {
        console.log("✅ Test successful - file can be encrypted and decrypted");
      } else {
        console.log("❌ Test failed");
      }
    } else {
      console.log("Usage: node encrypt-flipbook.js test <file-path>");
    }
  } else {
    console.log(`
        🔐 Flipbook Encryptor

        Usage:
        node encrypt-flipbook.js encrypt    # Encrypt entire flipbook
        node encrypt-flipbook.js test <file> # Test encryption on single file

        This will:
        1. Encrypt all files in assets/flipbook/
        2. Save encrypted files to assets/flipbook-encrypted/
        3. Create manifest.json with file mapping
    `);
  }
}
