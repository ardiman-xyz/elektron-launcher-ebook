// scripts/encrypt-flipbook.js - Simple Encryption
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class SimpleEncryptor {
  constructor() {
    this.secretKey = "EBOOK-SECRET-KEY-2025"; // Secret key untuk encryption
    this.inputDir = path.join(__dirname, "..", "assets", "flipbook");
    this.outputDir = path.join(__dirname, "..", "assets", "flipbook-encrypted");
  }

  // Simple XOR encryption (mudah untuk testing)
  encrypt(data, key) {
    let result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key.charCodeAt(i % key.length);
    }
    return result;
  }

  // Simple XOR decryption
  decrypt(data, key) {
    // XOR encryption is symmetric
    return this.encrypt(data, key);
  }

  // Encrypt single file
  encryptFile(inputPath, outputPath) {
    try {
      console.log(`🔐 Encrypting: ${path.basename(inputPath)}`);

      const data = fs.readFileSync(inputPath);
      const encrypted = this.encrypt(data, this.secretKey);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, encrypted);
      console.log(`✅ Saved: ${path.basename(outputPath)}`);
    } catch (error) {
      console.error(`❌ Error encrypting ${inputPath}:`, error.message);
    }
  }

  // Walk directory recursively
  walkDir(dir, callback) {
    if (!fs.existsSync(dir)) {
      console.error(`❌ Directory not found: ${dir}`);
      return;
    }

    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.walkDir(filePath, callback);
      } else {
        callback(filePath);
      }
    });
  }

  // Encrypt entire flipbook
  encryptFlipbook() {
    console.log("🚀 Starting simple flipbook encryption...");
    console.log(`📁 Input: ${this.inputDir}`);
    console.log(`📁 Output: ${this.outputDir}`);

    // Check if input exists
    if (!fs.existsSync(this.inputDir)) {
      console.error(`❌ Input directory not found: ${this.inputDir}`);
      console.log(
        "💡 Make sure you have assets/flipbook/ folder with your flipbook files"
      );
      return false;
    }

    // Clean output directory
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true, force: true });
      console.log("🗑️ Cleaned old encrypted files");
    }

    let fileCount = 0;
    let encryptedCount = 0;

    // Encrypt all files
    this.walkDir(this.inputDir, (filePath) => {
      fileCount++;

      // Get relative path
      const relativePath = path.relative(this.inputDir, filePath);
      const outputPath = path.join(this.outputDir, relativePath + ".enc");

      this.encryptFile(filePath, outputPath);
      encryptedCount++;
    });

    console.log(`\n✅ Encryption complete!`);
    console.log(`📊 Files processed: ${encryptedCount}/${fileCount}`);
    console.log(`📁 Encrypted files saved to: ${this.outputDir}`);

    // Create simple manifest
    this.createManifest(fileCount);

    return true;
  }

  // Create manifest file
  createManifest(fileCount) {
    const manifest = {
      version: "1.0.0",
      encrypted: true,
      encryption_type: "XOR",
      file_count: fileCount,
      created_at: new Date().toISOString(),
    };

    const manifestPath = path.join(this.outputDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`📋 Manifest created: ${manifestPath}`);
  }

  // Test encryption/decryption
  testEncryption() {
    console.log("🧪 Testing encryption...");

    const testData = "Hello, this is a test string for encryption!";
    const testBuffer = Buffer.from(testData, "utf8");

    console.log(`Original: ${testData}`);

    const encrypted = this.encrypt(testBuffer, this.secretKey);
    console.log(`Encrypted: ${encrypted.toString("hex")}`);

    const decrypted = this.decrypt(encrypted, this.secretKey);
    const decryptedText = decrypted.toString("utf8");
    console.log(`Decrypted: ${decryptedText}`);

    if (testData === decryptedText) {
      console.log("✅ Encryption test PASSED");
      return true;
    } else {
      console.log("❌ Encryption test FAILED");
      return false;
    }
  }
}

// Command line usage
if (require.main === module) {
  const encryptor = new SimpleEncryptor();

  const command = process.argv[2];

  switch (command) {
    case "encrypt":
      encryptor.encryptFlipbook();
      break;

    case "test":
      encryptor.testEncryption();
      break;

    default:
      console.log(`
🔐 Simple Flipbook Encryptor

Usage:
  node scripts/encrypt-flipbook.js encrypt    # Encrypt flipbook files
  node scripts/encrypt-flipbook.js test       # Test encryption

This will:
1. Read all files from assets/flipbook/
2. Encrypt each file with XOR
3. Save to assets/flipbook-encrypted/
4. Create manifest.json
      `);
  }
}

module.exports = SimpleEncryptor;
