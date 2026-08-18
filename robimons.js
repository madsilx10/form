const fs       = require("fs");
const readline = require("readline");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const REGISTER_URL = "https://www.robimons.app/api/register";
const DELAY_MS     = 2000; // jeda antar akun (ms)

const TASKS = {
  follow : 1787067190992,
  like   : 1787067192795,
  quote  : 1787067193967,
  reply  : 1787067195818,
};
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

async function register(address, handle) {
  const body = JSON.stringify({ address, handle, tasks: TASKS });

  const res = await fetch(REGISTER_URL, {
    method  : "POST",
    headers : { "Content-Type": "application/json" },
    body,
  });

  const json = await res.json();
  return { status: res.status, ...json };
}

async function main() {
  const handles = readLines("usn1.txt");
  const wallets = readLines("wallet.txt");

  const maxLen = Math.min(handles.length, wallets.length);
  if (handles.length !== wallets.length) {
    console.warn(
      `⚠  jumlah beda: ${handles.length} handle vs ${wallets.length} wallet → pakai ${maxLen} akun\n`
    );
  }

  console.log(`📋 Total akun tersedia: ${maxLen}\n`);

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

  const start = Math.max(1, argFrom) - 1;  // 0-based
  const end   = Math.min(argTo, maxLen);    // inclusive

  const total = end - start;
  if (total <= 0) {
    console.error(`❌ Range invalid: ${argFrom}–${argTo}`);
    process.exit(1);
  }

  console.log(`\n🚀 Register akun ${argFrom}–${end} (${total} akun)...\n`);

  let ok = 0, fail = 0;

  for (let i = start; i < end; i++) {
    const handle  = handles[i];
    const address = wallets[i];
    const num     = i - start + 1;

    process.stdout.write(`[${num}/${total}] akun#${i + 1} @${handle} | ${address.slice(0, 10)}... → `);

    try {
      const result = await register(address, handle);

      if (result.ok) {
        const flag = result.updated ? "UPDATED" : "NEW";
        console.log(`✅ ${flag} | registeredAt: ${result.registeredAt}`);
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

  console.log(`\n📊 Done: ${ok} berhasil, ${fail} gagal dari ${total} akun.`);
}

main();
