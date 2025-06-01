async function createEbookWindow() {
    try {
        console.log('📖 Starting e-book window creation...');
        
        // Check if e-book window already exists
        if (ebookWindow && !ebookWindow.isDestroyed()) {
            console.log('👁️ E-book window already exists, focusing...');
            ebookWindow.focus();
            return;
        }

        // Path to flipbook
        const flipbookPath = path.join(__dirname, 'assets', 'flipbook', 'index.html');
        
        console.log('📁 Checking flipbook path:', flipbookPath);
        
        // Check if flipbook exists
        if (!require('fs').existsSync(flipbookPath)) {
            console.error('❌ Flipbook not found at:', flipbookPath);
            throw new Error('E-book content not found at: ' + flipbookPath);
        }

        console.log('✅ Flipbook found, creating window...');

        // Create e-book window
        ebookWindow = new BrowserWindow({
            width: 1200,
            height: 850,
            minWidth: 900,
            minHeight: 700,
            title: '📚 E-book Viewer',
            show: true, // Show immediately for testing
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false // Disable for local files
            },
            autoHideMenuBar: true
        });

        console.log('🖼️ Window created, loading flipbook...');

        // Load flipbook
        await ebookWindow.loadFile(flipbookPath);
        
        console.log('📄 Flipbook loaded successfully');

        // Handle window events
        ebookWindow.on('closed', () => {
            ebookWindow = null;
            console.log('📖 E-book window closed');
        });

        ebookWindow.on('ready-to-show', () => {
            console.log('👁️ E-book window ready to show');
            ebookWindow.show();
            ebookWindow.focus();
        });

        // Add security after delay
        setTimeout(() => {
            if (ebookWindow && !ebookWindow.isDestroyed()) {
                ebookWindow.webContents.executeJavaScript(`
                    console.log('🔒 Adding security layer...');
                    
                    // Add protection indicator
                    const indicator = document.createElement('div');
                    indicator.innerHTML = '📚 Protected E-book';
                    indicator.style.cssText = \`
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        background: rgba(40, 167, 69, 0.9);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: bold;
                        z-index: 999999;
                        font-family: Arial, sans-serif;
                    \`;
                    document.body.appendChild(indicator);
                    
                    console.log('✅ Security layer added');
                `).catch(err => console.log('Security injection error:', err));
            }
        }, 2000);

        console.log('✅ E-book window setup completed');

    } catch (error) {
        console.error('❌ Error creating e-book window:', error);
        throw error;
    }
}
