const fs = require('fs');
const readline = require('readline');

const API_URL = 'https://www.hoodstarz.xyz/api/apply';
const AKUN_FILE = 'usn1.txt'; // satu handle per baris
const WALLET_FILE = 'wallet.txt'; // satu wallet per baris
const RESUME_FILE = 'resume_hoodstarz.json';
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
    console.error(`Jumlah baris ${AKUN_FILE} (${handles.length}) dan ${WALLET_FILE} (${wallets.length}) tidak sama.`);
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

async function applyWL(xUsername, wallet) {
  const body = {
    xUsername,
    wallet,
    followed: true,
    likedRt: true,
    tagged: true,
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

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

async function selectAccounts(total) {
  console.log('\nPilih target:');
  console.log('1. 1 akun');
  console.log('2. Semua akun');
  console.log('3. From x to end\n');

  const mode = await ask('Pilihan (1/2/3): ');

  if (mode === '1') {
    const num = await ask(`Nomor akun (1-${total}): `);
    const idx = parseInt(num, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= total) {
      console.error('Nomor tidak valid.');
      process.exit(1);
    }
    return [idx];
  }

  if (mode === '2') {
    return Array.from({ length: total }, (_, i) => i);
  }

  if (mode === '3') {
    const from = await ask(`Mulai dari nomor (1-${total}): `);
    const start = parseInt(from, 10) - 1;
    if (Number.isNaN(start) || start < 0 || start >= total) {
      console.error('Nomor tidak valid.');
      process.exit(1);
    }
    return Array.from({ length: total - start }, (_, i) => start + i);
  }

  console.error('Pilihan tidak valid.');
  process.exit(1);
}

async function main() {
  const accounts = loadAccounts();
  if (accounts.length === 0) {
    console.error('Tidak ada akun.');
    return;
  }

  const indices = await selectAccounts(accounts.length);
  const selected = indices.map((i) => accounts[i]);
  const resume = loadResume();

  for (let i = 0; i < selected.length; i++) {
    const { handle, wallet } = selected[i];

    if (resume[handle]?.ok) {
      console.log(`[SKIP] ${handle} sudah berhasil`);
      continue;
    }

    process.stdout.write(`[PROSES] ${handle} ... `);

    try {
      const { status, data } = await applyWL(handle, wallet);

      if (status === 200 && data.ok) {
        console.log('OK');
        resume[handle] = { ok: true, wallet };
      } else {
        console.log(`GAGAL - status ${status} - ${JSON.stringify(data)}`);
        resume[handle] = { ok: false, error: data, wallet };
      }
    } catch (err) {
      console.log(`ERROR - ${err.message}`);
      resume[handle] = { ok: false, error: err.message, wallet };
    }

    saveResume(resume);

    if (i !== selected.length - 1) {
      await sleep(randomDelay());
    }
  }

  console.log('\nSelesai. Hasil tersimpan di ' + RESUME_FILE);
}

main();
