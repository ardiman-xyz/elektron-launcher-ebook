const crypto = require("crypto");
const os = require("os");

class DeviceManager {
  async getDeviceFingerprint() {
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      user: os.userInfo().username,
    };

    return crypto
      .createHash("sha256")
      .update(JSON.stringify(systemInfo))
      .digest("hex");
  }

  async getSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      user: os.userInfo().username,
    };
  }
}

module.exports = DeviceManager;
