const fs       = require("fs");
const readline = require("readline");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WHITELIST_URL = "https://robillio.xyz/api/whitelist";
const DELAY_MS      = 2000;
// ──────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readLines(file) {
  return fs
    .readFileSync(file, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function whitelist(wallet) {
  const res = await fetch(WHITELIST_URL, {
    method  : "POST",
    headers : { "Content-Type": "application/json" },
    body    : JSON.stringify({ wallet }),
  });

  const json = await res.json();
  return { status: res.status, ...json };
}

async function main() {
  const wallets = readLines("wallet.txt");
  const maxLen  = wallets.length;

  console.log(`📋 Total wallet tersedia: ${maxLen}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const rawFrom = await ask(rl, `Dari akun ke berapa? (1–${maxLen}): `);
  const rawTo   = await ask(rl, `Sampai akun ke berapa? (1–${maxLen}): `);
  rl.close();

  const argFrom = parseInt(rawFrom);
  const argTo   = parseInt(rawTo);

  if (isNaN(argFrom) || isNaN(argTo)) {
    console.error("❌ Input harus angka.");
    process.exit(1);
  }

  const start = Math.max(1, argFrom) - 1;
  const end   = Math.min(argTo, maxLen);
  const total = end - start;

  if (total <= 0) {
    console.error(`❌ Range invalid: ${argFrom}–${argTo}`);
    process.exit(1);
  }

  console.log(`\n🚀 Whitelist akun ${argFrom}–${end} (${total} wallet)...\n`);

  let ok = 0, fail = 0;

  for (let i = start; i < end; i++) {
    const wallet = wallets[i];
    const num    = i - start + 1;

    process.stdout.write(`[${num}/${total}] akun#${i + 1} | ${wallet.slice(0, 10)}... → `);

    try {
      const result = await whitelist(wallet);

      if (result.success) {
        console.log(`✅ ${result.entry.id} | total: ${result.totalEntries} | sisa spot: ${result.remainingSpots}`);
        ok++;
      } else {
        console.log(`❌ FAILED | ${JSON.stringify(result)}`);
        fail++;
      }
    } catch (err) {
      console.log(`💥 ERROR | ${err.message}`);
      fail++;
    }

    if (i < end - 1) await sleep(DELAY_MS);
  }

  console.log(`\n📊 Done: ${ok} berhasil, ${fail} gagal dari ${total} wallet.`);
}

main();
