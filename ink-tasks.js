const fs = require('fs');
const readline = require('readline');

// ================= CONFIG =================

const WHITELIST_URL = 'https://www.inkvikings.xyz/api/whitelist';

const INKY_URL = 'https://hnvvyrbaohabwpiormfa.supabase.co/rest/v1/inky_task_submissions';
// WAJIB DIISI: apikey/anon key supabase punya inky (liat di Network tab, header "apikey" atau "authorization")
const INKY_SUPABASE_ANON_KEY = 'sb_publishable_CHqLLqjqntB_8e_j9Vtc6A_v4q3WVEI';
const INKY_X_PROFILE = 'https://x.com/TheInkyLabs';
const INKY_TASKS = ['follow-twitter', 'like-first-tweet', 'repost-first-tweet'];
const INKY_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

const INKAPE_URL = 'https://script.google.com/macros/s/AKfycbyDEw77BT_g6VvNy0F3WNBtecy8Pn8w0dA91-49HF1PqlKplxu5QE5bnPRtzPzNk4QR/exec';

// ================= HELPERS =================

function loadLines(path) {
  return fs.readFileSync(path, 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

function loadAll() {
  const handles = loadLines('usn1.txt');
  const wallets = loadLines('wallet.txt');

  const n = Math.min(handles.length, wallets.length);
  if (handles.length !== wallets.length) {
    console.log(`⚠️  Jumlah baris beda! usn=${handles.length} wallet=${wallets.length}`);
    console.log(`   Lanjut pakai ${n} data pertama yang match.\n`);
  }

  const combined = [];
  for (let i = 0; i < n; i++) {
    combined.push({ index: i + 1, handle: handles[i], wallet: wallets[i] });
  }
  return combined;
}

function randomDigits(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// generate status id: selalu diawali "20", sisanya random, total panjang = 19 digit (nyontoh contoh yang dikasih)
function randomStatusId() {
  return '20' + randomDigits(17);
}

function randomSerialNumber() {
  return `INKAPE-${randomDigits(4)}-2026`;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ================= PLATFORM 1: INKVIKINGS =================

async function whitelistOne(acc) {
  const body = { walletAddress: acc.wallet, xHandle: acc.handle };
  const res = await fetch(WHITELIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

async function processInkvikings(acc) {
  const r = await whitelistOne(acc);
  if ((r.status === 200 || r.status === 201) && r.data && r.data.ok) {
    console.log(`✅ [${acc.index}] ${acc.handle} -> whitelisted (id=${r.data.id}, status=${r.data.status})`);
  } else {
    console.log(`❌ [${acc.index}] ${acc.handle} -> gagal:`, r.status, r.data);
  }
}

// ================= PLATFORM 2: INKY =================

async function inkyOne(acc) {
  const body = {
    wallet_address: acc.wallet,
    x_username: acc.handle,
    x_profile: INKY_X_PROFILE,
    tasks: INKY_TASKS,
    user_agent: INKY_USER_AGENT,
  };
  const res = await fetch(INKY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': INKY_SUPABASE_ANON_KEY,
      'authorization': `Bearer ${INKY_SUPABASE_ANON_KEY}`,
      'content-profile': 'public',
      'x-client-info': 'the-inky-labs-task-board',
      'prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  const status = res.status;
  return { status };
}

async function processInky(acc) {
  const r = await inkyOne(acc);
  if (r.status === 201 || r.status === 200) {
    console.log(`✅ [${acc.index}] ${acc.handle} -> submitted`);
  } else {
    console.log(`❌ [${acc.index}] ${acc.handle} -> gagal, status=${r.status}`);
  }
}

// ================= PLATFORM 3: INK-APE =================

async function inkApeOne(acc) {
  const commentLink = `https://x.com/${acc.handle}/status/${randomStatusId()}?s=20`;
  const body = {
    twitterHandle: acc.handle,
    commentLink,
    evmWallet: acc.wallet,
    serialNumber: randomSerialNumber(),
    timestamp: new Date().toISOString(),
  };
  const res = await fetch(INKAPE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data, commentLink };
}

async function processInkApe(acc) {
  const r = await inkApeOne(acc);
  if (r.status === 200 || r.status === 201) {
    console.log(`✅ [${acc.index}] ${acc.handle} -> submitted (link=${r.commentLink})`);
  } else {
    console.log(`❌ [${acc.index}] ${acc.handle} -> gagal:`, r.status, r.data);
  }
}

// ================= MAIN =================

async function main() {
  const all = loadAll();
  if (all.length === 0) {
    console.log('Data kosong, cek usn1.txt / wallet.txt');
    return;
  }

  console.log(`Total akun terbaca: ${all.length}\n`);
  console.log('Pilih platform:');
  console.log('  1. InkVikings (whitelist)');
  console.log('  2. Inky (supabase)');
  console.log('  3. Ink-Ape (google script)\n');
  const platform = await ask('Platform (1/2/3): ');

  let processFn;
  if (platform === '1') processFn = processInkvikings;
  else if (platform === '2') processFn = processInky;
  else if (platform === '3') processFn = processInkApe;
  else { console.log('Pilihan gak valid.'); return; }

  console.log('\nPilih mode:');
  console.log('  1. Satu akun (pilih nomor)');
  console.log('  2. Semua akun');
  console.log('  3. Range (dari nomor x sampai akhir / atau x-y)\n');
  const mode = await ask('Masukkan pilihan (1/2/3): ');

  let targets = [];

  if (mode === '1') {
    const idx = parseInt(await ask(`Nomor akun (1-${all.length}): `), 10);
    const acc = all.find(a => a.index === idx);
    if (!acc) { console.log('Nomor gak valid.'); return; }
    targets = [acc];
  } else if (mode === '2') {
    targets = all;
  } else if (mode === '3') {
    const input = await ask(`Format "x-y" atau "x-end" (contoh: 3-end atau 3-10): `);
    const [startStr, endStr] = input.split('-').map(s => s.trim());
    const start = parseInt(startStr, 10);
    const end = (endStr === 'end' || !endStr) ? all.length : parseInt(endStr, 10);
    if (isNaN(start) || start < 1 || start > all.length) { console.log('Range gak valid.'); return; }
    targets = all.filter(a => a.index >= start && a.index <= end);
  } else {
    console.log('Pilihan gak valid.');
    return;
  }

  console.log(`\nMenjalankan ${targets.length} akun...\n`);

  for (const acc of targets) {
    await processFn(acc);
    const delay = Math.floor(Math.random() * (10000 - 2000 + 1)) + 2000; // random 2-10 detik
    console.log(`⏳ Delay ${(delay / 1000).toFixed(1)}s sebelum akun berikutnya...\n`);
    await new Promise(r => setTimeout(r, delay));
  }

  console.log('\nSelesai.');
}

main();
