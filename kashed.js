const fs = require("fs");
const https = require("https");
const readline = require("readline");

// ── CONFIG ──────────────────────────────────────────────────────────────────
const KASHED_ACTION  = "600ed14788126523ff80d5117b010c1966c38b3c46";
const SUPABASE_URL   = "https://ijnqlrsdzjdreffiysdw.supabase.co";
const SUPABASE_KEY   = "sb_publishable_TfpcjldooFLGfQfl5rGsWA_aQFwzEx1";
const FOLLOW_TARGET  = "playkashed";
const DELAY_MS       = 2000;
const BEARER         = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

// ── HELPERS ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
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
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function request(url, { method = "GET", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers,
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── 1. KASHED ────────────────────────────────────────────────────────────────
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
  return { status: res.status, success, body: res.body };
}

// ── 2. SUPABASE ───────────────────────────────────────────────────────────────
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
  return { status: res.status, success: res.status === 201, body: res.body };
}

// ── 3. TWITTER ────────────────────────────────────────────────────────────────
async function checkFollowing(authToken, ct0) {
  const res = await rawRequest({
    hostname: "api.x.com",
    path: `/1.1/friendships/show.json?source_screen_name=me&target_screen_name=${FOLLOW_TARGET}`,
    method: "GET",
    headers: xHeaders(authToken, ct0),
  });
  return res.body?.relationship?.source?.following === true;
}

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

// ── PROCESS ───────────────────────────────────────────────────────────────────
async function runProjek1(targets, usernames, wallets) {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`🟡 PROJEK 1 — kashed.fun (${targets.length} akun)`);
  console.log(`${"═".repeat(50)}\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < targets.length; i++) {
    const idx    = targets[i];
    const usn    = usernames[idx];
    const wallet = wallets[idx];
    console.log(`[${i + 1}/${targets.length}] @${usn} | ${wallet.slice(0, 10)}...`);
    try {
      const k = await kashedRegister(usn, wallet);
      if (k.success) {
        console.log(`  kashed → ✅`);
        ok++;
      } else {
        console.log(`  kashed → ⚠️  ${k.status} | ${k.body.slice(0, 120)}`);
        fail++;
      }
    } catch (e) {
      console.log(`  kashed → ❌ ${e.message}`);
      fail++;
    }
    if (i < targets.length - 1) await sleep(DELAY_MS);
  }
  console.log(`\n✅ Kashed selesai: ${ok} ok | ${fail} gagal\n`);
}

async function runProjek2(targets, usernames, wallets, akuns) {
  console.log(`${"═".repeat(50)}`);
  console.log(`🔵 PROJEK 2 — Lost Beings: Supabase + Follow @${FOLLOW_TARGET} (${targets.length} akun)`);
  console.log(`${"═".repeat(50)}\n`);

  let s_ok = 0, s_fail = 0, f_ok = 0, f_fail = 0;
  for (let i = 0; i < targets.length; i++) {
    const idx    = targets[i];
    const usn    = usernames[idx];
    const wallet = wallets[idx];
    const { authToken, ct0 } = akuns[idx];

    console.log(`[${i + 1}/${targets.length}] @${usn} | ${wallet.slice(0, 10)}...`);

    // Supabase
    try {
      const s = await supabaseSubmit(usn, wallet);
      if (s.success) {
        console.log(`  supabase → ✅`);
        s_ok++;
      } else {
        console.log(`  supabase → ⚠️  ${s.status} | ${s.body.slice(0, 120)}`);
        s_fail++;
      }
    } catch (e) {
      console.log(`  supabase → ❌ ${e.message}`);
      s_fail++;
    }

    // Cek dulu sebelum follow
    try {
      const sudahFollow = await checkFollowing(authToken, ct0);
      if (sudahFollow) {
        console.log(`  follow   → ⏭️  already following`);
        f_ok++;
      } else {
        const f = await followUser(authToken, ct0);
        if (f.success) {
          console.log(`  follow   → ✅`);
          f_ok++;
        } else {
          console.log(`  follow   → ⚠️  status ${f.status}`);
          f_fail++;
        }
      }
    } catch (e) {
      console.log(`  follow   → ❌ ${e.message}`);
      f_fail++;
    }

    if (i < targets.length - 1) await sleep(DELAY_MS);
    console.log();
  }

  console.log(`${"═".repeat(50)}`);
  console.log(`🏁 SUMMARY`);
  console.log(`  Supabase : ✅ ${s_ok} | ⚠️  ${s_fail}`);
  console.log(`  Follow   : ✅ ${f_ok} | ⚠️  ${f_fail}`);
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
  const total     = Math.min(usernames.length, wallets.length, akuns.length);

  if (total === 0) {
    console.error("❌ Data kosong atau jumlah baris gak match");
    process.exit(1);
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  KASHED + LOST BEINGS FARMER`);
  console.log(`${"═".repeat(50)}`);
  console.log(`  Total pair: ${total}`);
  console.log(`${"═".repeat(50)}\n`);

  console.log("Mode:");
  console.log("  1. 1 akun");
  console.log("  2. Semua");
  console.log("  3. From X to end\n");

  const mode = await prompt("Pilihan (1/2/3): ");
  let targets = [];

  if (mode === "1") {
    const idx = parseInt(await prompt(`Index akun (1-${total}): `)) - 1;
    if (isNaN(idx) || idx < 0 || idx >= total) {
      console.error("❌ Index invalid"); process.exit(1);
    }
    targets = [idx];
  } else if (mode === "2") {
    targets = Array.from({ length: total }, (_, i) => i);
  } else if (mode === "3") {
    const from = parseInt(await prompt(`Dari index (1-${total}): `)) - 1;
    if (isNaN(from) || from < 0 || from >= total) {
      console.error("❌ Index invalid"); process.exit(1);
    }
    targets = Array.from({ length: total - from }, (_, i) => i + from);
  } else {
    console.error("❌ Pilihan invalid"); process.exit(1);
  }

  await runProjek1(targets, usernames, wallets);
  await runProjek2(targets, usernames, wallets, akuns);
}

main().catch(console.error);
