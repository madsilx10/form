/**
 * Submit script untuk thebunkerhood.com/api/submit
 * Jalankan: node submit_bunkerhood.js
 *
 * Username & wallet dibaca dari file txt (satu data per baris),
 * dipasangkan berdasarkan urutan baris (baris 1 usn.txt <-> baris 1 wallet.txt, dst).
 */

const fs = require("fs");

const USERNAME_FILE = "usn.txt";
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
      x_username: usernames[i],
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
    follow_attempts: 1,
    like_attempts: 1,
    comment_attempts: 1,
    article_attempts: 1,
  };

  try {
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
  const results = [];
  for (const acc of ACCOUNTS) {
    const r = await submitOne(acc);
    results.push(r);
    // jeda dikit antar akun biar ga keliatan spam
    await new Promise((res) => setTimeout(res, 1500));
  }
  console.log("\n=== Ringkasan ===");
  console.table(results);
}

main();
