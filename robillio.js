const fs       = require("fs");
const readline = require("readline");
const axios    = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WHITELIST_URL = "https://robillio.xyz/api/whitelist";
const DELAY_MS      = 2000;

const PROXIES = [
  "http://mbqxqxyl:y6ldh0piyw65@31.59.20.176:6754",
  "http://mbqxqxyl:y6ldh0piyw65@31.56.127.193:7684",
  "http://mbqxqxyl:y6ldh0piyw65@45.38.107.97:6014",
  "http://mbqxqxyl:y6ldh0piyw65@198.105.121.200:6462",
  "http://mbqxqxyl:y6ldh0piyw65@64.137.96.74:6641",
  "http://mbqxqxyl:y6ldh0piyw65@198.23.243.226:6361",
  "http://mbqxqxyl:y6ldh0piyw65@38.154.185.97:6370",
  "http://mbqxqxyl:y6ldh0piyw65@84.247.60.125:6095",
  "http://mbqxqxyl:y6ldh0piyw65@142.111.67.146:5611",
  "http://mbqxqxyl:y6ldh0piyw65@191.96.254.138:6185",
  "http://aeyuigek:ye8w4nar7oqt@31.59.20.176:6754",
  "http://aeyuigek:ye8w4nar7oqt@31.56.127.193:7684",
  "http://aeyuigek:ye8w4nar7oqt@45.38.107.97:6014",
  "http://aeyuigek:ye8w4nar7oqt@198.105.121.200:6462",
  "http://aeyuigek:ye8w4nar7oqt@64.137.96.74:6641",
  "http://aeyuigek:ye8w4nar7oqt@198.23.243.226:6361",
  "http://aeyuigek:ye8w4nar7oqt@38.154.185.97:6370",
  "http://aeyuigek:ye8w4nar7oqt@84.247.60.125:6095",
  "http://aeyuigek:ye8w4nar7oqt@142.111.67.146:5611",
  "http://aeyuigek:ye8w4nar7oqt@191.96.254.138:6185",
  "http://wolqvtuk:rmzcit1543or@31.59.20.176:6754",
  "http://wolqvtuk:rmzcit1543or@31.56.127.193:7684",
  "http://wolqvtuk:rmzcit1543or@45.38.107.97:6014",
  "http://wolqvtuk:rmzcit1543or@198.105.121.200:6462",
  "http://wolqvtuk:rmzcit1543or@64.137.96.74:6641",
  "http://wolqvtuk:rmzcit1543or@198.23.243.226:6361",
  "http://wolqvtuk:rmzcit1543or@38.154.185.97:6370",
  "http://wolqvtuk:rmzcit1543or@84.247.60.125:6095",
  "http://wolqvtuk:rmzcit1543or@142.111.67.146:5611",
  "http://wolqvtuk:rmzcit1543or@191.96.254.138:6185",
  "http://kxtufsgx:zdo1a7igxmfq@31.59.20.176:6754",
  "http://kxtufsgx:zdo1a7igxmfq@31.56.127.193:7684",
  "http://kxtufsgx:zdo1a7igxmfq@45.38.107.97:6014",
  "http://kxtufsgx:zdo1a7igxmfq@198.105.121.200:6462",
  "http://kxtufsgx:zdo1a7igxmfq@64.137.96.74:6641",
  "http://kxtufsgx:zdo1a7igxmfq@198.23.243.226:6361",
  "http://kxtufsgx:zdo1a7igxmfq@38.154.185.97:6370",
  "http://kxtufsgx:zdo1a7igxmfq@84.247.60.125:6095",
  "http://kxtufsgx:zdo1a7igxmfq@142.111.67.146:5611",
  "http://kxtufsgx:zdo1a7igxmfq@191.96.254.138:6185",
];
// ──────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readLines(file) {
  return fs.readFileSync(file, "utf-8").split("\n").map((l) => l.trim()).filter(Boolean);
}

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

let proxyIndex = 0;
function getNextProxy() {
  const url = PROXIES[proxyIndex % PROXIES.length];
  proxyIndex++;
  return url;
}

async function checkIp(agent) {
  const res = await axios.get("https://api.ipify.org?format=json", { httpsAgent: agent, proxy: false, timeout: 8000 });
  return res.data.ip;
}

async function whitelist(wallet) {
  const proxyUrl = getNextProxy();
  const agent    = new HttpsProxyAgent(proxyUrl);
  const tag      = new URL(proxyUrl).host;

  // Verifikasi IP yang dipakai
  const ip = await checkIp(agent);
  process.stdout.write(`[IP: ${ip}] `);

  const res = await axios.post(WHITELIST_URL, { wallet }, { httpsAgent: agent, proxy: false });
  return { proxyTag: tag, ...res.data };
}

async function selectRange(rl, maxLen) {
  console.log(`\nPilih mode:`);
  console.log(`  1. 1 akun`);
  console.log(`  2. Semua akun`);
  console.log(`  3. Dari akun X sampai akhir`);

  const mode = (await ask(rl, `\nPilihan (1/2/3): `)).trim();

  if (mode === "1") {
    const raw = await ask(rl, `Akun ke berapa? (1–${maxLen}): `);
    const idx = parseInt(raw);
    if (isNaN(idx) || idx < 1 || idx > maxLen) throw new Error("Input invalid");
    return { start: idx - 1, end: idx };
  } else if (mode === "2") {
    return { start: 0, end: maxLen };
  } else if (mode === "3") {
    const raw = await ask(rl, `Mulai dari akun ke berapa? (1–${maxLen}): `);
    const idx = parseInt(raw);
    if (isNaN(idx) || idx < 1 || idx > maxLen) throw new Error("Input invalid");
    return { start: idx - 1, end: maxLen };
  } else {
    throw new Error("Pilihan tidak valid");
  }
}

async function main() {
  const wallets = readLines("wallet.txt");
  const maxLen  = wallets.length;

  console.log(`📋 Total wallet: ${maxLen}`);
  console.log(`🔌 ${PROXIES.length} proxy siap (rotating)`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const { start, end } = await selectRange(rl, maxLen);
  rl.close();

  const total = end - start;
  console.log(`\n🚀 Whitelist akun ${start + 1}–${end} (${total} wallet)...\n`);

  let ok = 0, fail = 0;

  for (let i = start; i < end; i++) {
    const wallet = wallets[i];
    const num    = i - start + 1;

    process.stdout.write(`[${num}/${total}] akun#${i + 1} | ${wallet.slice(0, 10)}... → `);

    try {
      const result = await whitelist(wallet);

      if (result.success) {
        console.log(`✅ ${result.entry.id} | proxy: ${result.proxyTag}`);
        ok++;
      } else {
        console.log(`❌ FAILED | ${JSON.stringify(result)}`);
        fail++;
      }
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.log(`💥 ERROR | ${detail}`);
      fail++;
    }

    if (i < end - 1) await sleep(DELAY_MS);
  }

  console.log(`\n📊 Done: ${ok} berhasil, ${fail} gagal dari ${total} wallet.`);
}

main();
