import fs from "fs";
import readline from "readline";

const TWEET_ID = "2087894490719940769";
const BASE_URL = "https://www.kupo.world/api";

// ─── Load akun dari file ───────────────────────────────────────────
function loadAccounts() {
  const usernames = fs.readFileSync("usn1.txt", "utf8").trim().split("\n").map(s => s.trim()).filter(Boolean);
  const wallets   = fs.readFileSync("wallet.txt", "utf8").trim().split("\n").map(s => s.trim()).filter(Boolean);

  // akun.txt: tiap akun = 2 baris (authtoken, ct0), dipisah baris kosong
  const akunRaw = fs.readFileSync("akun.txt", "utf8").trim().split(/\n\s*\n/);
  const akuns = akunRaw.map(block => {
    const lines = block.trim().split("\n").map(s => s.trim()).filter(Boolean);
    return { auth_token: lines[0], ct0: lines[1] };
  });

  const len = Math.min(usernames.length, wallets.length, akuns.length);
  const accounts = [];
  for (let i = 0; i < len; i++) {
    accounts.push({
      username:   usernames[i],
      wallet:     wallets[i],
      auth_token: akuns[i].auth_token,
      ct0:        akuns[i].ct0,
    });
  }
  return accounts;
}

// ─── Prompt input ──────────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ─── Utils ─────────────────────────────────────────────────────────
function randomDelay() {
  const ms = (Math.floor(Math.random() * 21) + 10) * 1000; // 10–30 detik
  return new Promise(r => setTimeout(r, ms));
}

function twitterHeaders(account) {
  return {
    "Content-Type": "application/json",
    "Cookie": `auth_token=${account.auth_token}; ct0=${account.ct0}`,
    "X-Csrf-Token": account.ct0,
    "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LTa1ujbmxtKMCBYIyI8M7gILZneTMoJJgk",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Referer": "https://twitter.com/",
    "X-Twitter-Auth-Type": "OAuth2Session",
    "X-Twitter-Client-Language": "en",
    "X-Twitter-Active-User": "yes",
  };
}

// ─── Twitter actions ───────────────────────────────────────────────
async function twitterFollow(account) {
  const lookupRes = await fetch("https://api.twitter.com/2/users/by/username/KupoNFTs", {
    headers: twitterHeaders(account),
  });
  const lookupData = await lookupRes.json();
  const targetId = lookupData?.data?.id;
  if (!targetId) throw new Error("Gagal ambil user ID KupoNFTs");

  const res = await fetch("https://api.twitter.com/1.1/friendships/create.json", {
    method: "POST",
    headers: { ...twitterHeaders(account), "Content-Type": "application/x-www-form-urlencoded" },
    body: `user_id=${targetId}`,
  });
  const data = await res.json();

  // Sudah follow sebelumnya → skip, lanjut verify
  if (data?.relationship?.source?.following === true) {
    console.log(`    ↳ Sudah follow sebelumnya, skip.`);
    return;
  }
  if (!data?.id) throw new Error(`Follow gagal: ${JSON.stringify(data)}`);
}

async function getMyId(account) {
  const res = await fetch("https://api.twitter.com/2/users/me", { headers: twitterHeaders(account) });
  const data = await res.json();
  const id = data?.data?.id;
  if (!id) throw new Error("Gagal ambil own user ID");
  return id;
}

async function twitterRT(account, myId) {
  const res = await fetch(`https://api.twitter.com/2/users/${myId}/retweets`, {
    method: "POST",
    headers: twitterHeaders(account),
    body: JSON.stringify({ tweet_id: TWEET_ID }),
  });
  const data = await res.json();

  // Sudah RT sebelumnya → Twitter return error 327
  if (data?.errors?.[0]?.code === 327 || data?.data?.retweeted === true) {
    console.log(`    ↳ Sudah RT sebelumnya, skip.`);
    return;
  }
  if (!data?.data?.retweeted) throw new Error(`RT gagal: ${JSON.stringify(data)}`);
}

async function twitterLike(account, myId) {
  const res = await fetch(`https://api.twitter.com/2/users/${myId}/likes`, {
    method: "POST",
    headers: twitterHeaders(account),
    body: JSON.stringify({ tweet_id: TWEET_ID }),
  });
  const data = await res.json();

  // Sudah like sebelumnya → Twitter return error 139
  if (data?.errors?.[0]?.code === 139 || data?.data?.liked === true) {
    console.log(`    ↳ Sudah like sebelumnya, skip.`);
    return;
  }
  if (!data?.data?.liked) throw new Error(`Like gagal: ${JSON.stringify(data)}`);
}

// ─── Kupo actions ──────────────────────────────────────────────────
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

    console.log(`${tag} Submit username...`);
    await kupoSubmitUsername(account);

    console.log(`${tag} Follow @KupoNFTs...`);
    await twitterFollow(account);

    console.log(`${tag} Verify follow...`);
    await kupoVerifyTask(account, "follow");

    const myId = await getMyId(account);

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
  accounts.forEach((a, i) => console.log(`  ${i + 1}. ${a.username} | ${a.wallet}`));

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
    if (isNaN(i) || i < 0 || i >= total) return console.error("Nomor akun tidak valid.");
    selected = [accounts[i]];

  } else if (mode === "2") {
    selected = accounts;

  } else if (mode === "3") {
    const from = await prompt(`Mulai dari akun nomor (1-${total}): `);
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
