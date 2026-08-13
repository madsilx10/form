/**
 * Submit script untuk thebunkerhood.com/api/submit
 * Jalankan: node submit_bunkerhood.js
 *
 * Username & wallet dibaca dari file txt (satu data per baris),
 * dipasangkan berdasarkan urutan baris (baris 1 usn.txt <-> baris 1 wallet.txt, dst).
 */

const fs = require("fs");
const readline = require("readline");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

const USERNAME_FILE = "usn1.txt";
const WALLET_FILE = "wallet.txt";

// Class dipilih random per akun dari daftar ini.
const CLASSES = [
  { class_name: "FARMER", class: "FARMER", class_code: "CLS-02" },
  { class_name: "WORKER", class: "WORKER", class_code: "CLS-01" },
];

const DEFAULT_COMMENT =
  "Mechanics, farmers, workers, IT, and administrators keep this place breathing.";

function pickRandomClass() {
  return CLASSES[Math.floor(Math.random() * CLASSES.length)];
}

function readLines(path) {
  return fs
    .readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function stripAt(username) {
  return username.startsWith("@") ? username.slice(1) : username;
}

function buildAccounts() {
  const usernames = readLines(USERNAME_FILE);
  const wallets = readLines(WALLET_FILE);

  if (usernames.length !== wallets.length) {
    console.warn(
      `Peringatan: jumlah baris usn.txt (${usernames.length}) dan wallet.txt (${wallets.length}) beda. ` +
        `Cuma ${Math.min(usernames.length, wallets.length)} akun yang diproses.`
    );
  }

  const count = Math.min(usernames.length, wallets.length);
  const accounts = [];
  for (let i = 0; i < count; i++) {
    accounts.push({
      x_username: stripAt(usernames[i]),
      wallet_address: wallets[i],
      ...pickRandomClass(),
      comment: DEFAULT_COMMENT,
      hold_position: true,
    });
  }
  return accounts;
}

const ACCOUNTS = buildAccounts();

const ENDPOINT = "https://thebunkerhood.com/api/submit";

/**
 * Cara pilih akun yang mau diproses, lewat argumen CLI:
 *   node bunkerhood.js all          -> semua akun
 *   node bunkerhood.js 3            -> cuma akun baris ke-3
 *   node bunkerhood.js 5-end        -> dari baris ke-5 sampai akhir
 *   node bunkerhood.js              -> default: all
 *
 * Nomor baris dihitung mulai dari 1 (baris pertama di usn.txt/wallet.txt).
 */
function selectAccounts(accounts, arg) {
  const mode = (arg || "all").trim().toLowerCase();

  if (mode === "all") return accounts;

  // single index: "3"
  if (/^\d+$/.test(mode)) {
    const idx = parseInt(mode, 10) - 1;
    if (idx < 0 || idx >= accounts.length) {
      throw new Error(`Index ${mode} di luar jangkauan (total ${accounts.length} akun).`);
    }
    return [accounts[idx]];
  }

  // range "X-end" atau "X-Y"
  const rangeMatch = mode.match(/^(\d+)-(end|\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10) - 1;
    const end = rangeMatch[2] === "end" ? accounts.length : parseInt(rangeMatch[2], 10);
    if (start < 0 || start >= accounts.length) {
      throw new Error(`Start index ${rangeMatch[1]} di luar jangkauan.`);
    }
    return accounts.slice(start, end);
  }

  throw new Error(
    `Argumen "${arg}" gak dikenali. Pakai: all | <nomor> | <nomor>-end | <nomor>-<nomor>`
  );
}

async function submitOne(acc) {
  const payload = {
    submitted_at: new Date().toISOString(),
    x_username: acc.x_username,
    wallet_address: acc.wallet_address,
    class_name: acc.class_name,
    class: acc.class,
    class_code: acc.class_code,
    comment: acc.comment,
    follow_verified: true,
    like_verified: true,
    comment_verified: true,
    article_verified: true,
    hold_confirmed: true,
    hold_position: acc.hold_position ?? true,
    follow_attempts: 2,
    like_attempts: 2,
    comment_attempts: 2,
    article_attempts: 2,
  };

  try {
    console.log(`[${acc.x_username}] payload:`, JSON.stringify(payload));
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`[${acc.x_username}] status ${res.status}:`, data);
    return { username: acc.x_username, status: res.status, data };
  } catch (err) {
    console.error(`[${acc.x_username}] error:`, err.message);
    return { username: acc.x_username, error: err.message };
  }
}

async function main() {
  let arg = process.argv[2];

  if (!arg) {
    console.log(`Total akun terbaca: ${ACCOUNTS.length}\n`);
    console.log("Pilih mode:");
    console.log("  1) 1 akun");
    console.log("  2) semua akun");
    console.log("  3) dari nomor X sampai akhir");
    const choice = (await ask("Masukkan pilihan (1/2/3): ")).trim();

    if (choice === "1") {
      const num = (await ask(`Nomor akun (1-${ACCOUNTS.length}): `)).trim();
      arg = num;
    } else if (choice === "2") {
      arg = "all";
    } else if (choice === "3") {
      const num = (await ask(`Mulai dari nomor (1-${ACCOUNTS.length}): `)).trim();
      arg = `${num}-end`;
    } else {
      console.error("Pilihan tidak valid.");
      process.exit(1);
    }
  }

  let selected;
  try {
    selected = selectAccounts(ACCOUNTS, arg);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }

  console.log(`\nMemproses ${selected.length} dari ${ACCOUNTS.length} akun (mode: ${arg})\n`);

  const results = [];
  for (const acc of selected) {
    const r = await submitOne(acc);
    results.push(r);
    // jeda dikit antar akun biar ga keliatan spam
    await new Promise((res) => setTimeout(res, 1500));
  }
  console.log("\n=== Ringkasan ===");
  console.table(results);
}

main();
