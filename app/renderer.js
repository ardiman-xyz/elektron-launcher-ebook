// Common renderer functions for all pages
console.log("🔧 Renderer script loaded");

// Global error handler
window.addEventListener("error", (e) => {
  console.error("❌ Global error:", e.error);
});

// Global unhandled promise rejection handler
window.addEventListener("unhandledrejection", (e) => {
  console.error("❌ Unhandled promise rejection:", e.reason);
});

// Utility functions available to all pages
window.utils = {
  // Format date helper
  formatDate: (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return "Invalid Date";
    }
  },

  // Format time helper
  formatTime: (dateString) => {
    try {
      return new Date(dateString).toLocaleTimeString();
    } catch (error) {
      return "Invalid Time";
    }
  },

  // Show loading state
  showLoading: (element, text = "Loading...") => {
    if (element) {
      element.innerHTML = `<div class="spinner"></div> ${text}`;
      element.disabled = true;
    }
  },

  // Hide loading state
  hideLoading: (element, originalText) => {
    if (element) {
      element.innerHTML = originalText;
      element.disabled = false;
    }
  },

  // Debounce function
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
};

// Check if electronAPI is available
if (window.electronAPI) {
  console.log("✅ Electron API available");
  console.log("📱 Platform:", window.electronAPI.platform);
} else {
  console.error("❌ Electron API not available");
}
