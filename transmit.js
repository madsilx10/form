const fs = require('fs');
const readline = require('readline');

const URL = 'https://zdqpxpqjpqhnnnhclwsf.supabase.co/functions/v1/submit-transmission';
const DELAY_MS = 1500;

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
}

function randomUsn(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function submit(wallet, twitterHandle, idx, total) {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, twitterHandle })
    });
    const data = await res.json();
    const status = data.ok ? '✓' : '✗';
    console.log(`[${idx}/${total}] ${status} ${twitterHandle} | ${wallet.slice(0,10)}... | ${res.status} | id: ${data.transmissionId || data.error || '-'}`);
    return data;
  } catch (err) {
    console.log(`[${idx}/${total}] ERR ${twitterHandle} | ${err.message}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  console.log('\n=== Transmission Bot ===\n');
  console.log('1. usn1.txt + wallet.txt (pair per baris)');
  console.log('2. Random usn + walletplus.txt');
  const mode = (await ask('\nMode [1/2]: ')).trim();

  let accounts = [];

  if (mode === '1') {
    const usns = readLines('usn1.txt');
    const wallets = readLines('wallet.txt');
    const len = Math.min(usns.length, wallets.length);
    for (let i = 0; i < len; i++) accounts.push({ usn: usns[i], wallet: wallets[i] });
    console.log(`\nLoaded ${accounts.length} akun dari usn1.txt + wallet.txt`);
  } else if (mode === '2') {
    const wallets = readLines('walletplus.txt');
    for (const wallet of wallets) accounts.push({ usn: randomUsn(), wallet });
    console.log(`\nLoaded ${accounts.length} akun dari walletplus.txt (usn random)`);
  } else {
    console.log('Mode tidak valid'); rl.close(); return;
  }

  console.log('\nOpsi run:');
  console.log('1. 1 akun');
  console.log('2. Semua');
  console.log('3. From X to end');
  const opt = (await ask('\nOpsi [1/2/3]: ')).trim();

  let toRun = [];

  if (opt === '1') {
    const raw = await ask(`Akun ke- (1-${accounts.length}): `);
    const idx = parseInt(raw) - 1;
    if (isNaN(idx) || idx < 0 || idx >= accounts.length) {
      console.log('Index tidak valid'); rl.close(); return;
    }
    toRun = [accounts[idx]];
  } else if (opt === '2') {
    toRun = accounts;
  } else if (opt === '3') {
    const raw = await ask(`Dari akun ke- (1-${accounts.length}): `);
    const from = parseInt(raw) - 1;
    if (isNaN(from) || from < 0 || from >= accounts.length) {
      console.log('Index tidak valid'); rl.close(); return;
    }
    toRun = accounts.slice(from);
    console.log(`Run dari akun ${from + 1} sampai ${accounts.length} (total ${toRun.length})`);
  } else {
    console.log('Opsi tidak valid'); rl.close(); return;
  }

  rl.close();
  console.log(`\nMulai ${toRun.length} akun...\n`);

  for (let i = 0; i < toRun.length; i++) {
    const { wallet, usn } = toRun[i];
    await submit(wallet, usn, i + 1, toRun.length);
    if (i < toRun.length - 1) await sleep(DELAY_MS);
  }

  console.log('\nSelesai!');
}

main().catch(console.error);
