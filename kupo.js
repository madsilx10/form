import fs from "fs";
import readline from "readline";

const TWEET_ID = "2087894490719940769";
const BASE_URL = "https://www.kupo.world/api";

// ─── Load akun dari file ───────────────────────────────────────────
// ─── Sanitize token dari karakter tak-kasat-mata (zero-width, BOM) ──
function sanitizeToken(s) {
  if (!s) return s;
  return s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim();
}

function loadAccounts() {
  const usernames = fs.readFileSync("usn1.txt", "utf8").trim().split("\n").map(s => s.trim()).filter(Boolean);
  const wallets   = fs.readFileSync("wallet.txt", "utf8").trim().split("\n").map(s => s.trim()).filter(Boolean);

  const akunRaw = fs.readFileSync("akun.txt", "utf8").trim().split(/\n\s*\n/);
  const akuns = akunRaw.map(block => {
    const lines = block.trim().split("\n").map(s => s.trim()).filter(Boolean);
    return { auth_token: lines[0], ct0: lines[1] };
  });

  console.log(`📊 usn1.txt: ${usernames.length} baris | wallet.txt: ${wallets.length} baris | akun.txt: ${akuns.length} blok`);
  if (usernames.length !== wallets.length || usernames.length !== akuns.length) {
    console.log(`⚠️  JUMLAH GAK SAMA! Ini kemungkinan besar penyebab token ke-pasang ke akun yang salah.`);
  }

  const len = Math.min(usernames.length, wallets.length, akuns.length);
  const accounts = [];
  for (let i = 0; i < len; i++) {
    const at = sanitizeToken(akuns[i].auth_token || "");
    const ct = sanitizeToken(akuns[i].ct0 || "");
    console.log(`  [${i + 1}] ${usernames[i]} → auth_token:${at.slice(0,6)}...${at.slice(-4)} (len:${at.length}) | ct0:${ct.slice(0,6)}...${ct.slice(-4)} (len:${ct.length})`);
    accounts.push({
      username:   usernames[i],
      wallet:     wallets[i],
      auth_token: at,
      ct0:        ct,
    });
  }
  return accounts;
}

// ─── Prompt ────────────────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ─── Generate X-Client-Transaction-Id ──────────────────────────────
function genTransactionId() {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Buffer.from(bytes).toString("base64");
}

// ─── Twitter headers ───────────────────────────────────────────────
function twHeaders(account) {
  return {
    "Cookie": `auth_token=${account.auth_token}; ct0=${account.ct0}`,
    "X-Csrf-Token": account.ct0,
    "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LTa1Uq16cHjhLTvJu4FA33AGWWjCpTnA",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Referer": "https://x.com/",
    "Origin": "https://x.com",
    "X-Twitter-Auth-Type": "OAuth2Session",
    "X-Twitter-Client-Language": "id",
    "X-Twitter-Active-User": "yes",
    "X-Client-Transaction-Id": genTransactionId(),
    "Accept": "*/*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Ch-Ua": '"Chromium";v="137", "Not/A)Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?1",
    "Sec-Ch-Ua-Platform": '"Android"',
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  };
}

// ─── Twitter actions ───────────────────────────────────────────────
const KUPONFT_USER_ID = "2087488162171871232";

async function twitterFollow(account) {
  const followHeaders = { ...twHeaders(account), "Content-Type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams({
    include_profile_interstitial_type: "1",
    include_blocking: "1",
    include_blocked_by: "1",
    include_followed_by: "1",
    include_want_retweets: "1",
    include_mute_edge: "1",
    include_can_dm: "1",
    include_can_media_tag: "1",
    include_ext_is_blue_verified: "1",
    include_ext_verified_type: "1",
    include_ext_profile_image_shape: "1",
    skip_status: "1",
    user_id: KUPONFT_USER_ID,
  }).toString();

  const res = await fetch("https://x.com/i/api/1.1/friendships/create.json", {
    method: "POST",
    headers: followHeaders,
    body,
  });
  const text = await res.text();
  console.log(`    ↳ [DEBUG follow] status:${res.status} body:${text.substring(0, 200)}`);

  if (res.status === 401) {
    throw new Error(`Follow gagal: 401 Unauthorized — auth_token/ct0 akun ini kemungkinan invalid/expired/logout. Cek ulang cookie-nya.`);
  }
  if (res.status === 403) {
    throw new Error(`Follow gagal: 403 Forbidden — akun mungkin ke-lock/suspend atau kena bot-detection.`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Follow gagal: response bukan JSON (status ${res.status}): ${text.substring(0, 200)}`);
  }

  if (data?.relationship?.source?.following === true) {
    console.log(`    ↳ Sudah follow, skip.`);
    return;
  }
  if (!data?.id_str && !data?.id) throw new Error(`Follow gagal: ${JSON.stringify(data)}`);
}

async function getMyId(account) {
  const res = await fetch("https://x.com/i/api/1.1/account/verify_credentials.json", {
    headers: twHeaders(account),
  });
  if (res.status === 401) {
    throw new Error(`Token invalid/expired (401 di verify_credentials) — auth_token/ct0 akun ini sudah mati, ganti cookie-nya.`);
  }
  const data = await res.json();
  const id = data?.id_str;
  if (!id) throw new Error(`Gagal ambil own user ID: ${JSON.stringify(data)}`);
  return id;
}

async function twitterRT(account, myId) {
  const res = await fetch(`https://x.com/i/api/2/users/${myId}/retweets`, {
    method: "POST",
    headers: { ...twHeaders(account), "Content-Type": "application/json" },
    body: JSON.stringify({ tweet_id: TWEET_ID }),
  });
  const data = await res.json();

  if (data?.errors?.[0]?.code === 327 || data?.data?.retweeted === true) {
    console.log(`    ↳ Sudah RT, skip.`);
    return;
  }
  if (!data?.data?.retweeted) throw new Error(`RT gagal: ${JSON.stringify(data)}`);
}

async function twitterLike(account, myId) {
  const res = await fetch(`https://x.com/i/api/2/users/${myId}/likes`, {
    method: "POST",
    headers: { ...twHeaders(account), "Content-Type": "application/json" },
    body: JSON.stringify({ tweet_id: TWEET_ID }),
  });
  const data = await res.json();

  if (data?.errors?.[0]?.code === 139 || data?.data?.liked === true) {
    console.log(`    ↳ Sudah like, skip.`);
    return;
  }
  if (!data?.data?.liked) throw new Error(`Like gagal: ${JSON.stringify(data)}`);
}

// ─── Kupo headers & actions ────────────────────────────────────────
function kupoHeaders() {
  return {
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Origin": "https://www.kupo.world",
    "Referer": "https://www.kupo.world/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  };
}

async function kupoSubmitUsername(account) {
  const res = await fetch(`${BASE_URL}/submit`, {
    method: "POST",
    headers: kupoHeaders(),
    body: JSON.stringify({ stage: "xUser", xUser: account.username }),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(`Submit username gagal: ${JSON.stringify(data)}`);
}

async function kupoVerifyTask(account, task) {
  const res = await fetch(`${BASE_URL}/verify-task`, {
    method: "POST",
    headers: kupoHeaders(),
    body: JSON.stringify({ task, xUser: account.username }),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(`Verify ${task} gagal: ${JSON.stringify(data)}`);
}

async function kupoSubmitWallet(account) {
  const res = await fetch(`${BASE_URL}/submit`, {
    method: "POST",
    headers: kupoHeaders(),
    body: JSON.stringify({ stage: "wallet", xUser: account.username, wallet: account.wallet }),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(`Submit wallet gagal: ${JSON.stringify(data)}`);
}

// ─── Process satu akun ─────────────────────────────────────────────
async function processAccount(account, index, total) {
  const tag = `[${index}/${total}] [${account.username}]`;
  try {
    console.log(`\n${tag} ── Mulai`);

    console.log(`${tag} Cek token...`);
    const myId = await getMyId(account);

    console.log(`${tag} Submit username...`);
    await kupoSubmitUsername(account);

    console.log(`${tag} Follow @KupoNFTs...`);
    await twitterFollow(account);

    console.log(`${tag} Verify follow...`);
    await kupoVerifyTask(account, "follow");

    console.log(`${tag} Retweet...`);
    await twitterRT(account, myId);

    console.log(`${tag} Verify RT...`);
    await kupoVerifyTask(account, "rt");

    console.log(`${tag} Like...`);
    await twitterLike(account, myId);

    console.log(`${tag} Verify like...`);
    await kupoVerifyTask(account, "like");

    console.log(`${tag} Submit wallet...`);
    await kupoSubmitWallet(account);

    console.log(`${tag} ✅ DONE!`);
  } catch (err) {
    console.error(`${tag} ❌ ERROR: ${err.message}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  const accounts = loadAccounts();
  const total = accounts.length;

  console.log(`\n📋 Total akun: ${total}`);
  console.log(`
Pilih mode:
  1. Satu akun
  2. Semua akun
  3. From X to end
`);

  const mode = await prompt("Pilihan (1/2/3): ");
  let selected = [];

  if (mode === "1") {
    const idx = await prompt(`Nomor akun (1-${total}): `);
    const i = parseInt(idx) - 1;
    if (isNaN(i) || i < 0 || i >= total) return console.error("Nomor tidak valid.");
    selected = [accounts[i]];

  } else if (mode === "2") {
    selected = accounts;

  } else if (mode === "3") {
    const from = await prompt(`Mulai dari nomor (1-${total}): `);
    const i = parseInt(from) - 1;
    if (isNaN(i) || i < 0 || i >= total) return console.error("Nomor tidak valid.");
    selected = accounts.slice(i);

  } else {
    return console.error("Pilihan tidak valid.");
  }

  console.log(`\n🚀 Menjalankan ${selected.length} akun...\n`);

  for (let i = 0; i < selected.length; i++) {
    await processAccount(selected[i], i + 1, selected.length);
    if (i < selected.length - 1) {
      const secs = Math.floor(Math.random() * 21) + 10;
      console.log(`\n⏳ Delay ${secs}s sebelum akun berikutnya...`);
      await new Promise(r => setTimeout(r, secs * 1000));
    }
  }

  console.log("\n✅ Semua akun selesai!");
}

main();
