const fs = require('fs');
const readline = require('readline');

const WHITELIST_URL = 'https://talesofblobs.com/api/whitelist';

function loadWallets(path) {
  return fs.readFileSync(path, 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

async function whitelistOne(wallet) {
  const res = await fetch(WHITELIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet }),
  });

  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  const wallets = loadWallets('wallet.txt');
  if (wallets.length === 0) {
    console.log('wallet.txt kosong.');
    return;
  }

  console.log(`Total wallet terbaca: ${wallets.length}\n`);
  console.log('Pilih mode:');
  console.log('  1. Satu wallet (pilih nomor)');
  console.log('  2. Semua wallet');
  console.log('  3. Range (dari nomor x sampai akhir / atau x-y)\n');

  const mode = await ask('Masukkan pilihan (1/2/3): ');

  let targets = [];

  if (mode === '1') {
    const idx = parseInt(await ask(`Nomor wallet (1-${wallets.length}): `), 10);
    if (isNaN(idx) || idx < 1 || idx > wallets.length) { console.log('Nomor gak valid.'); return; }
    targets = [{ index: idx, wallet: wallets[idx - 1] }];
  } else if (mode === '2') {
    targets = wallets.map((w, i) => ({ index: i + 1, wallet: w }));
  } else if (mode === '3') {
    const input = await ask(`Format "x-y" atau "x-end" (contoh: 3-end atau 3-10): `);
    const [startStr, endStr] = input.split('-').map(s => s.trim());
    const start = parseInt(startStr, 10);
    const end = (endStr === 'end' || !endStr) ? wallets.length : parseInt(endStr, 10);
    if (isNaN(start) || start < 1 || start > wallets.length) { console.log('Range gak valid.'); return; }
    targets = wallets
      .map((w, i) => ({ index: i + 1, wallet: w }))
      .filter(t => t.index >= start && t.index <= end);
  } else {
    console.log('Pilihan gak valid.');
    return;
  }

  console.log(`\nMenjalankan ${targets.length} wallet...\n`);

  for (const t of targets) {
    const r = await whitelistOne(t.wallet);
    if ((r.status === 200 || r.status === 201) && r.data && r.data.ok) {
      console.log(`✅ [${t.index}] ${t.wallet} -> whitelisted`);
    } else {
      console.log(`❌ [${t.index}] ${t.wallet} -> gagal:`, r.status, r.data);
    }

    const delay = Math.floor(Math.random() * (30000 - 5000 + 1)) + 5000; // random 5-30 detik
    console.log(`⏳ Delay ${(delay / 1000).toFixed(1)}s...\n`);
    await new Promise(r => setTimeout(r, delay));
  }

  console.log('Selesai.');
}

main();
