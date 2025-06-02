// test-connection.js - Test Laravel API connection
const http = require("http");

function testConnection() {
  console.log("🧪 Testing Laravel API connection...");

  const options = {
    hostname: "127.0.0.1",
    port: 8001,
    path: "/api/health",
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    timeout: 5000,
  };

  const req = http.request(options, (res) => {
    let data = "";

    console.log(`📡 Status Code: ${res.statusCode}`);
    console.log(`📡 Headers:`, res.headers);

    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      console.log("✅ Response:", data);
      try {
        const json = JSON.parse(data);
        console.log("🎉 Laravel API is working!");
        console.log("📄 Response data:", json);
      } catch (e) {
        console.log("⚠️ Response is not JSON:", data);
      }
    });
  });

  req.on("error", (error) => {
    console.error("❌ Connection failed:", error.message);
    console.log("💡 Make sure Laravel server is running: php artisan serve");
  });

  req.on("timeout", () => {
    console.error("❌ Connection timeout");
    req.destroy();
  });

  req.setTimeout(5000);
  req.end();
}

// Run test
testConnection();
