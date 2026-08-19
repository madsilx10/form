const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

const PROXIES = [
  "http://mbqxqxyl:y6ldh0piyw65@31.59.20.176:6754",
  "http://aeyuigek:ye8w4nar7oqt@31.56.127.193:7684",
  "http://wolqvtuk:rmzcit1543or@45.38.107.97:6014",
];

async function testProxy(proxyUrl) {
  const agent = new HttpsProxyAgent(proxyUrl);
  const tag   = new URL(proxyUrl).host;
  try {
    const res = await axios.get("https://api.ipify.org?format=json", {
      httpsAgent: agent,
      timeout: 8000,
    });
    console.log(`✅ ${tag} → IP: ${res.data.ip}`);
  } catch (err) {
    console.log(`❌ ${tag} → ${err.message}`);
  }
}

// Test tanpa proxy dulu (IP asli)
async function main() {
  console.log("🔍 IP asli lo:");
  const real = await axios.get("https://api.ipify.org?format=json");
  console.log(`   ${real.data.ip}\n`);

  console.log("🔍 Test proxy:");
  for (const p of PROXIES) {
    await testProxy(p);
  }
}

main();
