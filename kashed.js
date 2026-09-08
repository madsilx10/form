const fs = require("fs");
const https = require("https");

// ── CONFIG ──────────────────────────────────────────────────────────────────
const KASHED_ACTION  = "600ed14788126523ff80d5117b010c1966c38b3c46";
const SUPABASE_URL   = "https://ijnqlrsdzjdreffiysdw.supabase.co";
const SUPABASE_KEY   = "sb_publishable_TfpcjldooFLGfQfl5rGsWA_aQFwzEx1";
const FOLLOW_TARGET  = "playkashed"; // tanpa @
const DELAY_MS       = 2000;         // jeda antar akun (ms)

// ── HELPERS ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readLines(file) {
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Baca akun.txt → [{authToken, ct0}, ...] */
function readAkun(file) {
  const lines = fs.readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim());

  const accounts = [];
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    if (a && b) {
      accounts.push({ authToken: a, ct0: b });
      i++; // skip baris ct0
    }
  }
  return accounts;
}

/** Generic fetch pakai https bawaan Node (biar jalan di Termux tanpa install) */
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
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      "Referer": "https://www.kashed.fun/",
      "Content-Length": Buffer.byteLength(payload).toString(),
    },
    body: payload,
  });
  // Response: 0:{...}\n1:{"success":true}
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
async function getTwitterUserId(username, authToken, ct0) {
  const vars = encodeURIComponent(JSON.stringify({
    screen_name: username,
    withSafetyModeUserFields: true,
  }));
  const features = encodeURIComponent(JSON.stringify({
    hidden_profile_likes_enabled: true,
    hidden_profile_subscriptions_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  }));

  const res = await request(
    `https://twitter.com/i/api/graphql/NimuplG1OB7Fd2btCLdBOw/UserByScreenName?variables=${vars}&features=${features}`,
    {
      headers: {
        Cookie: `auth_token=${authToken}; ct0=${ct0}`,
        "X-Csrf-Token": ct0,
        Authorization:
          "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I7wlcjwAAAAJ",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "X-Twitter-Active-User": "yes",
        "X-Twitter-Auth-Type": "OAuth2Session",
        "X-Twitter-Client-Language": "en",
        Referer: `https://twitter.com/${username}`,
      },
    }
  );

  if (res.status !== 200) {
    console.log(`  [debug] graphql status: ${res.status}`);
    return null;
  }
  try {
    const json = JSON.parse(res.body);
    return json?.data?.user?.result?.rest_id ?? null;
  } catch {
    return null;
  }
}

async function followUser(targetUserId, authToken, ct0) {
  const payload = `user_id=${targetUserId}&include_entities=false&skip_status=true`;
  const res = await request("https://api.twitter.com/1.1/friendships/create.json", {
    method: "POST",
    headers: {
      Cookie: `auth_token=${authToken}; ct0=${ct0}`,
      "X-Csrf-Token": ct0,
      Authorization:
        "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I7wlcjwAAAAJ",
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(payload).toString(),
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    },
    body: payload,
  });
  return { status: res.status, success: res.status === 200 };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  // Baca file
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

  console.log(`\n🚀 Kashed.fun + Supabase + Follow @${FOLLOW_TARGET}`);
  console.log(`📋 Total akun: ${total}\n`);

  // Ambil user_id target follow sekali aja pakai akun pertama
  console.log(`🔍 Ngambil user_id @${FOLLOW_TARGET}...`);
  const targetId = await getTwitterUserId(FOLLOW_TARGET, akuns[0].authToken, akuns[0].ct0);
  if (!targetId) {
    console.error(`❌ Gagal ambil user_id @${FOLLOW_TARGET}. Cek auth akun pertama.`);
    process.exit(1);
  }
  console.log(`✅ User ID @${FOLLOW_TARGET}: ${targetId}\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < total; i++) {
    const usn    = usernames[i];
    const wallet = wallets[i];
    const { authToken, ct0 } = akuns[i];

    console.log(`[${i + 1}/${total}] @${usn} | ${wallet.slice(0, 8)}...`);

    // Step 1: Kashed register
    try {
      const k = await kashedRegister(usn, wallet);
      console.log(`  kashed  → ${k.success ? "✅" : "⚠️ " + k.status}`);
    } catch (e) {
      console.log(`  kashed  → ❌ ${e.message}`);
    }

    // Step 2: Supabase submit
    try {
      const s = await supabaseSubmit(usn, wallet);
      console.log(`  supabase→ ${s.success ? "✅" : "⚠️ " + s.status}`);
    } catch (e) {
      console.log(`  supabase→ ❌ ${e.message}`);
    }

    // Step 3: Follow
    try {
      const f = await followUser(targetId, authToken, ct0);
      if (f.success) {
        console.log(`  follow  → ✅`);
        ok++;
      } else {
        console.log(`  follow  → ⚠️ status ${f.status}`);
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
