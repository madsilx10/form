const fs = require('fs');
const readline = require('readline');

const WHITELIST_URL = 'https://www.mudlarknft.com/api/whitelist';
const TARGET_SCREEN_NAME = 'MUDLARK_nft';

// bearer token publik yang dipakai web client X (bukan rahasia, dipakai luas di tools open source)
const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTg%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

function loadAccounts(path) {
  const raw = fs.readFileSync(path, 'utf8').replace(/\r/g, '');
  const blocks = raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => {
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
    return { authToken: lines[0], ct0: lines[1] };
  });
}

function loadLines(path) {
  return fs.readFileSync(path, 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

function loadAll() {
  const accounts = loadAccounts('akun.txt');
  const handles = loadLines('usn1.txt');
  const wallets = loadLines('wallet.txt');

  const n = Math.min(accounts.length, handles.length, wallets.length);
  if (accounts.length !== handles.length || accounts.length !== wallets.length) {
    console.log(`⚠️  Jumlah baris beda-beda! akun=${accounts.length} usn=${handles.length} wallet=${wallets.length}`);
    console.log(`   Lanjut pakai ${n} data pertama yang match.\n`);
  }

  const combined = [];
  for (let i = 0; i < n; i++) {
    combined.push({
      index: i + 1,
      authToken: accounts[i].authToken,
      ct0: accounts[i].ct0,
      handle: handles[i],
      wallet: wallets[i],
    });
  }
  return combined;
}

async function followTarget(acc) {
  const url = `https://api.x.com/1.1/friendships/create.json?screen_name=${TARGET_SCREEN_NAME}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${BEARER}`,
      'cookie': `auth_token=${acc.authToken}; ct0=${acc.ct0}`,
      'x-csrf-token': acc.ct0,
      'content-type': 'application/x-www-form-urlencoded',
    },
  });

  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

async function whitelistOne(acc) {
  const body = { address: acc.wallet, xHandle: acc.handle };
  const res = await fetch(WHITELIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

async function processOne(acc) {
  // 1. follow
  const f = await followTarget(acc);
  const followOk = f.status === 200 && !(f.data && f.data.errors);
  if (followOk) {
    console.log(`👤 [${acc.index}] ${acc.handle} -> follow OK`);
  } else {
    console.log(`⚠️  [${acc.index}] ${acc.handle} -> follow gagal/duplikat:`, f.status, JSON.stringify(f.data).slice(0, 200));
    // lanjut aja ke whitelist, siapa tau udah follow duluan / error karena "already following"
  }

  // 2. whitelist
  const w = await whitelistOne(acc);
  if (w.status === 200 && w.data && w.data.ok) {
    console.log(`✅ [${acc.index}] ${acc.handle} -> whitelisted`);
  } else {
    console.log(`❌ [${acc.index}] ${acc.handle} -> whitelist gagal:`, w.status, w.data);
  }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  const all = loadAll();
  if (all.length === 0) {
    console.log('Data kosong, cek akun.txt / usn1.txt / wallet.txt');
    return;
  }

  console.log(`Total akun terbaca: ${all.length}\n`);
  console.log('Pilih mode:');
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
    await processOne(acc);
    await new Promise(r => setTimeout(r, 1200)); // delay lebih santai krn 2 request per akun
  }

  console.log('\nSelesai.');
}

main();
