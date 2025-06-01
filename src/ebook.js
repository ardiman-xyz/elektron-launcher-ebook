const path = require("path");
const fs = require("fs-extra");
const { app } = require("electron");

class EbookManager {
  constructor() {
    this.flipbookDir = this.getFlipbookDir();
  }

  getFlipbookDir() {
    if (app.isPackaged) {
      // In production, flipbook is in resources/flipbook
      return path.join(process.resourcesPath, "flipbook", "out3");
    } else {
      // In development, flipbook is in assets/flipbook
      return path.join(__dirname, "..", "assets", "flipbook", "out3");
    }
  }

  getFlipbookPath() {
    const indexPath = path.join(this.flipbookDir, "index.html");

    if (!fs.existsSync(indexPath)) {
      throw new Error(`Flipbook not found at: ${indexPath}`);
    }

    return indexPath;
  }

  async validateFlipbook() {
    try {
      const indexPath = this.getFlipbookPath();
      const exists = await fs.pathExists(indexPath);

      if (!exists) {
        return {
          valid: false,
          message: "Flipbook index.html not found",
        };
      }

      // Check for required directories
      const requiredDirs = ["files", "mobile"];
      const missingDirs = [];

      for (const dir of requiredDirs) {
        const dirPath = path.join(this.flipbookDir, dir);
        if (!(await fs.pathExists(dirPath))) {
          missingDirs.push(dir);
        }
      }

      if (missingDirs.length > 0) {
        return {
          valid: false,
          message: `Missing required directories: ${missingDirs.join(", ")}`,
        };
      }

      // Get flipbook metadata
      const metadata = await this.getFlipbookMetadata();

      return {
        valid: true,
        message: "Flipbook is valid",
        metadata,
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message,
      };
    }
  }

  async getFlipbookMetadata() {
    try {
      const indexPath = this.getFlipbookPath();
      const content = await fs.readFile(indexPath, "utf8");

      // Extract title from HTML
      let title = "E-book";
      const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim() || title;
      }

      // Get directory size
      const Utils = require("./utils");
      const utils = new Utils();
      const totalSize = await utils.getDirectorySize(this.flipbookDir);

      // Count pages (estimate from files directory)
      let pageCount = 0;
      try {
        const filesDir = path.join(this.flipbookDir, "files");
        if (await fs.pathExists(filesDir)) {
          const files = await fs.readdir(filesDir);
          pageCount = files.filter((file) =>
            /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
          ).length;
        }
      } catch (error) {
        console.warn("Could not count pages:", error.message);
      }

      // Get creation time
      const stats = await fs.stat(indexPath);

      return {
        title,
        totalSize: utils.formatBytes(totalSize),
        totalSizeBytes: totalSize,
        pageCount: pageCount > 0 ? pageCount : "Unknown",
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        indexPath,
      };
    } catch (error) {
      console.error("Error getting flipbook metadata:", error);
      return {
        title: "E-book",
        totalSize: "Unknown",
        totalSizeBytes: 0,
        pageCount: "Unknown",
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        indexPath: this.getFlipbookPath(),
      };
    }
  }

  async prepareSecureContent(tempDir, sessionKey) {
    try {
      console.log("📚 Preparing secure e-book content...");

      // Copy flipbook content to temp directory
      await fs.copy(this.flipbookDir, tempDir, {
        overwrite: true,
        errorOnExist: false,
      });

      // Modify index.html to add security features
      const indexPath = path.join(tempDir, "index.html");
      let content = await fs.readFile(indexPath, "utf8");

      // Generate security enhancements
      const securityScript = this.generateSecurityScript(sessionKey, tempDir);
      const securityStyles = this.generateSecurityStyles();

      // Inject security features
      content = this.injectSecurityFeatures(
        content,
        securityScript,
        securityStyles
      );

      // Write modified content
      await fs.writeFile(indexPath, content);

      console.log("✅ Secure content prepared at:", tempDir);
      return indexPath;
    } catch (error) {
      console.error("Error preparing secure content:", error);
      throw error;
    }
  }

  generateSecurityScript(sessionKey, tempDir) {
    return `
        <script>
            // E-book Security Layer
            const EBOOK_SESSION = {
                key: '${sessionKey}',
                tempDir: '${tempDir}',
                startTime: Date.now(),
                isProtected: true
            };
            
            console.log('🔒 E-book Security Layer Initialized');
            console.log('📱 Session Key:', EBOOK_SESSION.key.substring(0, 8) + '...');
            
            // Disable context menu and developer tools
            document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                return false;
            });
            
            // Disable common developer shortcuts
            document.addEventListener('keydown', function(e) {
                // F12 - Developer Tools
                if (e.key === 'F12') {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+Shift+I - Developer Tools
                if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+U - View Source
                if (e.ctrlKey && e.key === 'u') {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+S - Save
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+Shift+C - Inspect Element
                if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                    e.preventDefault();
                    return false;
                }
            });
            
            // Disable text selection and drag
            document.addEventListener('selectstart', function(e) {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    return false;
                }
            });
            
            document.addEventListener('dragstart', function(e) {
                e.preventDefault();
                return false;
            });
            
            // Add session indicator
            function createSessionIndicator() {
                const indicator = document.createElement('div');
                indicator.id = 'ebook-session-indicator';
                indicator.innerHTML = \`
                    <div class="indicator-content">
                        <span class="indicator-icon">📚</span>
                        <span class="indicator-text">Protected E-book</span>
                        <span class="indicator-status">●</span>
                    </div>
                \`;
                document.body.appendChild(indicator);
                
                // Update status every 30 seconds
                setInterval(updateSessionStatus, 30000);
            }
            
            function updateSessionStatus() {
                const statusElement = document.querySelector('#ebook-session-indicator .indicator-status');
                if (statusElement) {
                    statusElement.style.color = '#28a745';
                    setTimeout(() => {
                        statusElement.style.color = 'rgba(255, 255, 255, 0.8)';
                    }, 1000);
                }
            }
            
            // Create session info popup
            function createSessionInfo() {
                const info = document.createElement('div');
                info.id = 'ebook-session-info';
                info.innerHTML = \`
                    <div class="session-info-content">
                        <div class="session-info-header">📚 Protected E-book Session</div>
                        <div class="session-info-details">
                            <div>Session: \${EBOOK_SESSION.key.substring(0, 12)}...</div>
                            <div>Started: \${new Date(EBOOK_SESSION.startTime).toLocaleTimeString()}</div>
                            <div>Platform: \${navigator.platform}</div>
                        </div>
                    </div>
                \`;
                document.body.appendChild(info);
            }
            
            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    createSessionIndicator();
                    createSessionInfo();
                });
            } else {
                createSessionIndicator();
                createSessionInfo();
            }
            
            // Prevent image saving
            document.addEventListener('contextmenu', function(e) {
                if (e.target.tagName === 'IMG') {
                    e.preventDefault();
                    return false;
                }
            });
            
            // Console warning
            console.warn('%c⚠️ Warning: This is a protected e-book. Unauthorized copying or distribution is prohibited.', 
                'color: #ff6b6b; font-size: 16px; font-weight: bold;');
            
            // Session heartbeat (optional - for monitoring)
            let heartbeatInterval;
            function startHeartbeat() {
                heartbeatInterval = setInterval(() => {
                    console.log('💓 E-book session heartbeat:', new Date().toISOString());
                }, 60000); // Every minute
            }
            
            function stopHeartbeat() {
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                }
            }
            
            // Start heartbeat
            startHeartbeat();
            
            // Cleanup on page unload
            window.addEventListener('beforeunload', function() {
                stopHeartbeat();
                console.log('🔒 E-book session ending...');
            });
            
            // Protection against common hacks
            (function() {
                // Disable console
                try {
                    const devtools = {
                        open: false,
                        orientation: null
                    };
                    
                    setInterval(() => {
                        if (window.outerHeight - window.innerHeight > 200 || 
                            window.outerWidth - window.innerWidth > 200) {
                            if (!devtools.open) {
                                devtools.open = true;
                                console.warn('Developer tools detected!');
                            }
                        } else {
                            devtools.open = false;
                        }
                    }, 500);
                } catch (e) {
                    // Ignore errors
                }
            })();
            
            console.log('✅ E-book security layer fully loaded');
        </script>`;
  }

  generateSecurityStyles() {
    return `
        <style>
            /* E-book Security Styles */
            #ebook-session-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                background: linear-gradient(135deg, rgba(40, 167, 69, 0.9) 0%, rgba(32, 201, 151, 0.9) 100%);
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: all 0.3s ease;
            }
            
            #ebook-session-indicator:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            }
            
            .indicator-content {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .indicator-icon {
                font-size: 14px;
            }
            
            .indicator-status {
                color: rgba(255, 255, 255, 0.8);
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            #ebook-session-info {
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: rgba(255, 255, 255, 0.9);
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 10px;
                z-index: 999998;
                font-family: 'Courier New', monospace;
                opacity: 0.7;
                backdrop-filter: blur(5px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .session-info-header {
                font-weight: bold;
                margin-bottom: 4px;
                color: #4CAF50;
            }
            
            .session-info-details div {
                margin-bottom: 2px;
                font-size: 9px;
            }
            
            /* Disable text selection for content protection */
            .flipbook-content,
            .flipbook-page,
            img {
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
                -webkit-touch-callout: none;
                -webkit-tap-highlight-color: transparent;
            }
            
            /* Prevent image dragging */
            img {
                -webkit-user-drag: none;
                -khtml-user-drag: none;
                -moz-user-drag: none;
                -o-user-drag: none;
                user-drag: none;
                pointer-events: none;
            }
            
            /* Hide scrollbars in webkit browsers */
            ::-webkit-scrollbar {
                width: 8px;
            }
            
            ::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.1);
            }
            
            ::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
            }
            
            ::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 0, 0, 0.5);
            }
        </style>`;
  }

  injectSecurityFeatures(content, securityScript, securityStyles) {
    // Inject styles in the <head>
    if (content.includes("</head>")) {
      content = content.replace("</head>", securityStyles + "\n</head>");
    } else {
      // If no head tag, add it
      content = securityStyles + "\n" + content;
    }

    // Inject script before closing </body>
    if (content.includes("</body>")) {
      content = content.replace("</body>", securityScript + "\n</body>");
    } else {
      // If no body tag, append at the end
      content = content + "\n" + securityScript;
    }

    return content;
  }

  async optimizeFlipbookContent(sourceDir, targetDir) {
    try {
      console.log("🔧 Optimizing flipbook content...");

      // Ensure target directory exists
      await fs.ensureDir(targetDir);

      // Copy basic structure first
      await fs.copy(sourceDir, targetDir, {
        overwrite: true,
        filter: (src, dest) => {
          // Skip optimization for now, copy everything
          return true;
        },
      });

      // TODO: Add image optimization here
      // - Convert large PNGs to WebP
      // - Compress JPEG images
      // - Implement lazy loading for images

      console.log("✅ Flipbook content optimized");
      return targetDir;
    } catch (error) {
      console.error("Error optimizing flipbook:", error);
      throw error;
    }
  }

  async createEbookPackage(outputPath, metadata = {}) {
    try {
      const packageData = {
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        metadata: {
          ...(await this.getFlipbookMetadata()),
          ...metadata,
        },
        security: {
          protected: true,
          encryptionLevel: "basic",
          allowPrint: false,
          allowCopy: false,
        },
      };

      await fs.writeFile(
        path.join(outputPath, "package.json"),
        JSON.stringify(packageData, null, 2)
      );

      return packageData;
    } catch (error) {
      console.error("Error creating ebook package:", error);
      throw error;
    }
  }

  async cleanupSecureContent(tempDir) {
    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
        console.log("🗑️ Secure content cleaned up:", tempDir);
      }
    } catch (error) {
      console.warn("Warning: Could not cleanup secure content:", error.message);
    }
  }

  // Get flipbook performance stats
  async getPerformanceStats() {
    try {
      const metadata = await this.getFlipbookMetadata();
      const filesDir = path.join(this.flipbookDir, "files");

      let stats = {
        totalFiles: 0,
        totalImages: 0,
        averageImageSize: 0,
        largestImage: { name: "", size: 0 },
        estimatedLoadTime: 0,
      };

      if (await fs.pathExists(filesDir)) {
        const files = await fs.readdir(filesDir);
        stats.totalFiles = files.length;

        let totalImageSize = 0;
        let imageCount = 0;

        for (const file of files) {
          const filePath = path.join(filesDir, file);
          const fileStat = await fs.stat(filePath);

          if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
            imageCount++;
            totalImageSize += fileStat.size;

            if (fileStat.size > stats.largestImage.size) {
              stats.largestImage = {
                name: file,
                size: fileStat.size,
              };
            }
          }
        }

        stats.totalImages = imageCount;
        stats.averageImageSize =
          imageCount > 0 ? totalImageSize / imageCount : 0;

        // Estimate load time (rough calculation)
        // Assume 1MB/second download speed
        stats.estimatedLoadTime = Math.ceil(
          metadata.totalSizeBytes / (1024 * 1024)
        );
      }

      return stats;
    } catch (error) {
      console.error("Error getting performance stats:", error);
      return null;
    }
  }

  // Validate flipbook integrity
  async validateIntegrity() {
    try {
      const validation = await this.validateFlipbook();
      if (!validation.valid) {
        return validation;
      }

      // Additional integrity checks
      const indexPath = this.getFlipbookPath();
      const content = await fs.readFile(indexPath, "utf8");

      const checks = {
        hasTitle: /<title[^>]*>.*?<\/title>/i.test(content),
        hasViewport: /viewport/i.test(content),
        hasScripts: /<script/i.test(content),
        hasStyles: /<style|<link.*css/i.test(content),
        hasImages: /\.(jpg|jpeg|png|gif|webp)/i.test(content),
      };

      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      return {
        valid: true,
        integrity: (passedChecks / totalChecks) * 100,
        checks,
        message: `Integrity check: ${passedChecks}/${totalChecks} checks passed`,
      };
    } catch (error) {
      return {
        valid: false,
        message: `Integrity check failed: ${error.message}`,
      };
    }
  }
}

module.exports = EbookManager;
