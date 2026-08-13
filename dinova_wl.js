const fs = require('fs');
const readline = require('readline');

const API_URL = 'https://dinovagame.com/api/apply';
const AKUN_FILE = 'usn1.txt'; // satu handle per baris
const WALLET_FILE = 'wallet.txt'; // satu wallet per baris
const RESUME_FILE = 'resume_wl.json';
const MIN_DELAY = 3000;
const MAX_DELAY = 8000;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

function readLines(path) {
  if (!fs.existsSync(path)) {
    console.error(`File ${path} tidak ditemukan.`);
    process.exit(1);
  }
  return fs.readFileSync(path, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function loadAccounts() {
  const handles = readLines(AKUN_FILE);
  const wallets = readLines(WALLET_FILE);

  if (handles.length !== wallets.length) {
    console.error(`Jumlah baris akun.txt (${handles.length}) dan wallet.txt (${wallets.length}) tidak sama.`);
    process.exit(1);
  }

  return handles.map((handle, i) => ({ handle, wallet: wallets[i] }));
}

function loadResume() {
  if (fs.existsSync(RESUME_FILE)) {
    return JSON.parse(fs.readFileSync(RESUME_FILE, 'utf-8'));
  }
  return {};
}

function saveResume(resume) {
  fs.writeFileSync(RESUME_FILE, JSON.stringify(resume, null, 2));
}

async function applyWL(handle, wallet) {
  const body = {
    handle,
    wallet,
    tasks: { follow: true, engage: true, comment: true },
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { ok: false, error: 'invalid_json_response', status: res.status };
  }

  return { status: res.status, data };
}

async function askAccountSelection(accounts) {
  console.log('\nDaftar akun:');
  accounts.forEach((a, i) => console.log(`${i + 1}. ${a.handle} -> ${a.wallet}`));
  console.log('0. Semua akun');
  console.log('Range: contoh "3-7" (dari 3 sampai 7), atau "5-" (dari 5 sampai akhir)\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => {
    rl.question('Pilih akun (nomor, koma, range, atau 0 untuk semua): ', res);
  });
  rl.close();

  const trimmed = answer.trim();
  if (trimmed === '0' || trimmed === '') return accounts;

  const indices = new Set();
  for (const part of trimmed.split(',').map((s) => s.trim())) {
    if (!part) continue;

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = endStr === '' ? accounts.length : parseInt(endStr, 10);

      if (Number.isNaN(start) || Number.isNaN(end)) continue;

      for (let i = start; i <= end; i++) indices.add(i - 1);
    } else {
      const idx = parseInt(part, 10) - 1;
      if (!Number.isNaN(idx)) indices.add(idx);
    }
  }

  return [...indices]
    .filter((i) => i >= 0 && i < accounts.length)
    .sort((a, b) => a - b)
    .map((i) => accounts[i]);
}

async function main() {
  const accounts = loadAccounts();
  if (accounts.length === 0) {
    console.error('Tidak ada akun di accounts.txt');
    return;
  }

  const selected = await askAccountSelection(accounts);
  const resume = loadResume();

  for (const { handle, wallet } of selected) {
    if (resume[handle]?.ok) {
      console.log(`[SKIP] ${handle} sudah berhasil (app #${resume[handle].applicationNumber})`);
      continue;
    }

    process.stdout.write(`[PROSES] ${handle} (${wallet}) ... `);

    try {
      const { status, data } = await applyWL(handle, wallet);

      if (status === 200 && data.ok) {
        console.log(`OK - application #${data.applicationNumber}`);
        resume[handle] = { ok: true, applicationNumber: data.applicationNumber, wallet };
      } else {
        console.log(`GAGAL - status ${status} - ${JSON.stringify(data)}`);
        resume[handle] = { ok: false, error: data, wallet };
      }
    } catch (err) {
      console.log(`ERROR - ${err.message}`);
      resume[handle] = { ok: false, error: err.message, wallet };
    }

    saveResume(resume);

    if (selected.indexOf({ handle, wallet }) !== selected.length - 1) {
      const delay = randomDelay();
      await sleep(delay);
    }
  }

  console.log('\nSelesai. Hasil tersimpan di resume_wl.json');
}

main();
