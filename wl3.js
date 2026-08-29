const fs = require("fs");
const readline = require("readline");

// ─────────────────── CONFIG ───────────────────
const BAFOONTOWN_ACCESS_KEY = "9bb13e90-02df-46a4-8284-f07bdd2365b0";
const DELAY_PROJECT  = [1500, 3000];
const DELAY_ACCOUNT  = [3000, 6000];


// ─────────────────── UTILS ────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randDelay = ([min, max]) => sleep(rand(min, max));

const loadLines = (file) => {
  if (!fs.existsSync(file)) { console.error(`[ERROR] File tidak ada: ${file}`); process.exit(1); }
  return fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
};

const fmtUsn  = (u) => (u.startsWith("@") ? u : `@${u}`);
const rawUsn  = (u) => u.replace(/^@/, "");

const genTweetId = () => "20" + Array.from({ length: 17 }, () => rand(0, 9)).join("");
const genLink    = (usn, qs = "?s=20") => `https://x.com/${rawUsn(usn)}/status/${genTweetId()}${qs}`;


// ─────────────────── SUBMITTERS ───────────────
async function post(url, payload, headers = {}) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
    return { code: res.status, body: await res.text() };
  } catch (e) {
    return { code: 0, body: e.message };
  }
}

async function submitBafoontown(wallet, usn) {
  return post("https://api.web3forms.com/submit", {
    access_key : BAFOONTOWN_ACCESS_KEY,
    subject    : "New BAFOONTOWN GTD Application",
    from_name  : "BAFOONTOWN Site",
    wallet,
    twitter    : fmtUsn(usn),
    tasks      : "3/3",
  }, { Accept: "application/json" });
}

async function submitZorpians(wallet, usn) {
  const receipt = genLink(usn, "?=20");
  console.log(`         receipt : ${receipt}`);
  return post("https://zorpians.xyz/api/whitelist", {
    handle  : fmtUsn(usn),
    wallet,
    company : "SPCX",
    receipt,
    website : "",
  });
}

async function submitMoonalisas(wallet, usn) {
  const proof = genLink(usn, "?s=20");
  console.log(`         proof   : ${proof}`);
  return post("https://moonalisas.xyz/api/submit.php", {
    x_handle     : fmtUsn(usn),
    evm_wallet   : wallet,
    comment_proof: proof,
    followed     : true,
    liked_rt     : true,
  });
}


// ─────────────────── PROCESS ──────────────────
const icon = (code) => code === 200 ? "✅" : code === 0 ? "💥" : "⚠️ ";

async function processAccount(wallet, usn, idx) {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`  [${idx}] ${fmtUsn(usn)}`);
  console.log(`       ${wallet}`);
  console.log("─".repeat(55));

  let r;

  r = await submitBafoontown(wallet, usn);
  console.log(`  ${icon(r.code)} BAFOONTOWN  [${r.code}] ${r.body.slice(0, 80)}`);
  await randDelay(DELAY_PROJECT);

  r = await submitZorpians(wallet, usn);
  console.log(`  ${icon(r.code)} ZORPIANS    [${r.code}] ${r.body.slice(0, 80)}`);
  await randDelay(DELAY_PROJECT);

  r = await submitMoonalisas(wallet, usn);
  console.log(`  ${icon(r.code)} MOONALISAS  [${r.code}] ${r.body.slice(0, 80)}`);
}


// ─────────────────── MAIN ─────────────────────
async function main() {
  const wallets = loadLines("wallet.txt");
  const usns    = loadLines("usn1.txt");
  const total   = Math.min(wallets.length, usns.length);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log(`\n📋 Total akun: ${total}`);
  console.log("   1. 1 akun");
  console.log("   2. Semua akun");
  console.log("   3. From X to end");

  const choice = (await ask("\nPilih mode [1/2/3]: ")).trim();
  let pairs = [];

  if (choice === "1") {
    const idx = parseInt(await ask(`Index akun (1-${total}): `)) - 1;
    pairs = [[idx + 1, wallets[idx], usns[idx]]];
  } else if (choice === "2") {
    pairs = Array.from({ length: total }, (_, i) => [i + 1, wallets[i], usns[i]]);
  } else if (choice === "3") {
    const start = parseInt(await ask(`Start dari index (1-${total}): `)) - 1;
    pairs = Array.from({ length: total - start }, (_, i) => [start + i + 1, wallets[start + i], usns[start + i]]);
  } else {
    console.log("Pilihan tidak valid.");
    rl.close(); return;
  }

  rl.close();
  console.log(`\n🚀 Menjalankan ${pairs.length} akun...\n`);

  for (let i = 0; i < pairs.length; i++) {
    const [idx, wallet, usn] = pairs[i];
    await processAccount(wallet, usn, idx);
    if (i < pairs.length - 1) {
      const d = rand(...DELAY_ACCOUNT);
      console.log(`\n  ⏳ Delay ${(d / 1000).toFixed(1)}s...\n`);
      await sleep(d);
    }
  }

  console.log(`\n${"═".repeat(55)}`);
  console.log(`  ✅ Selesai — ${pairs.length} akun diproses`);
  console.log("═".repeat(55) + "\n");
}

main();
