const fs = require("fs");
const https = require("https");

// ── CONFIG ──────────────────────────────────────────────────────────────────
const KASHED_ACTION  = "600ed14788126523ff80d5117b010c1966c38b3c46";
const SUPABASE_URL   = "https://ijnqlrsdzjdreffiysdw.supabase.co";
const SUPABASE_KEY   = "sb_publishable_TfpcjldooFLGfQfl5rGsWA_aQFwzEx1";
const FOLLOW_TARGET  = "playkashed";
const DELAY_MS       = 2000;
const BEARER         = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

// ── HELPERS ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readLines(file) {
  return fs.readFileSync(file, "utf8")
    .split("\n").map((l) => l.trim()).filter(Boolean);
}

function readAkun(file) {
  const lines = fs.readFileSync(file, "utf8")
    .split("\n").map((l) => l.trim());
  const accounts = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i] && lines[i + 1])
      accounts.push({ authToken: lines[i], ct0: lines[i + 1] });
  }
  return accounts;
}

function xHeaders(authToken, ct0, extra = {}) {
  return {
    authorization: BEARER,
    cookie: `auth_token=${authToken}; ct0=${ct0}`,
    "x-csrf-token": ct0,
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "id",
    origin: "https://x.com",
    referer: "https://x.com/",
    ...extra,
  };
}

function rawRequest(opts, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function request(url, { method = "GET", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers,
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── 1. KASHED REGISTER ───────────────────────────────────────────────────────
async function kashedRegister(username, wallet) {
  const payload = JSON.stringify([username, wallet]);
  const res = await request("https://www.kashed.fun/", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "Accept": "text/x-component",
      "next-action": KASHED_ACTION,
      "next-router-state-tree":
        '%5B%22%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C4608%5D%7D%2Cnull%2Cnull%2C4624%5D',
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      "Referer": "https://www.kashed.fun/",
      "Content-Length": Buffer.byteLength(payload).toString(),
    },
    body: payload,
  });
  const success = res.body.includes('"success":true');
  return { status: res.status, success };
}

// ── 2. SUPABASE SUBMIT ───────────────────────────────────────────────────────
async function supabaseSubmit(username, wallet) {
  const payload = JSON.stringify({
    x_handle: username,
    evm_wallet: wallet,
    follow_opened: true,
    like_opened: true,
    repost_opened: true,
    quote_opened: true,
    comment_opened: true,
    source: "lost-beings-evm-signal",
  });
  const res = await request(`${SUPABASE_URL}/rest/v1/lost_beings_evm_applications`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      "Content-Length": Buffer.byteLength(payload).toString(),
    },
    body: payload,
  });
  return { status: res.status, success: res.status === 201 };
}

// ── 3. TWITTER FOLLOW ────────────────────────────────────────────────────────
async function followUser(authToken, ct0) {
  const body = `screen_name=${FOLLOW_TARGET}&skip_status=true`;
  const res = await rawRequest({
    hostname: "api.x.com",
    path: "/1.1/friendships/create.json",
    method: "POST",
    headers: xHeaders(authToken, ct0, {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": Buffer.byteLength(body),
    }),
  }, body);
  return { status: res.status, success: res.status === 200 };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync("usn1.txt") || !fs.existsSync("wallet.txt") || !fs.existsSync("akun.txt")) {
    console.error("❌ File kurang. Pastikan ada: usn1.txt, wallet.txt, akun.txt");
    process.exit(1);
  }

  const usernames = readLines("usn1.txt");
  const wallets   = readLines("wallet.txt");
  const akuns     = readAkun("akun.txt");

  const total = Math.min(usernames.length, wallets.length, akuns.length);
  if (total === 0) {
    console.error("❌ Data kosong atau jumlah baris gak match");
    process.exit(1);
  }

  console.log(`\n🚀 Kashed.fun + Lost Beings + Follow @${FOLLOW_TARGET}`);
  console.log(`📋 Total akun: ${total}\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < total; i++) {
    const usn    = usernames[i];
    const wallet = wallets[i];
    const { authToken, ct0 } = akuns[i];

    console.log(`[${i + 1}/${total}] @${usn} | ${wallet.slice(0, 10)}...`);

    // Step 1: Kashed register
    try {
      const k = await kashedRegister(usn, wallet);
      console.log(`  kashed  → ${k.success ? "✅" : "⚠️  status " + k.status}`);
    } catch (e) {
      console.log(`  kashed  → ❌ ${e.message}`);
    }

    // Step 2: Supabase submit
    try {
      const s = await supabaseSubmit(usn, wallet);
      console.log(`  supabase→ ${s.success ? "✅" : "⚠️  status " + s.status}`);
    } catch (e) {
      console.log(`  supabase→ ❌ ${e.message}`);
    }

    // Step 3: Follow
    try {
      const f = await followUser(authToken, ct0);
      if (f.success) {
        console.log(`  follow  → ✅`);
        ok++;
      } else {
        console.log(`  follow  → ⚠️  status ${f.status}`);
        fail++;
      }
    } catch (e) {
      console.log(`  follow  → ❌ ${e.message}`);
      fail++;
    }

    if (i < total - 1) await sleep(DELAY_MS);
    console.log();
  }

  console.log(`\n🏁 Selesai! Follow: ✅ ${ok} | ⚠️ ${fail}`);
}

main().catch(console.error);
