const fs = require("fs");

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

  const total = Math.min(handles.length, wallets.length);
  if (handles.length !== wallets.length) {
    console.warn(
      `⚠  jumlah beda: ${handles.length} handle vs ${wallets.length} wallet → pakai ${total} akun`
    );
  }

  console.log(`🚀 Mulai register ${total} akun...\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < total; i++) {
    const handle  = handles[i];
    const address = wallets[i];

    process.stdout.write(`[${i + 1}/${total}] @${handle} | ${address.slice(0, 10)}... → `);

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

    if (i < total - 1) await sleep(DELAY_MS);
  }

  console.log(`\n📊 Done: ${ok} berhasil, ${fail} gagal dari ${total} akun.`);
}

main();
