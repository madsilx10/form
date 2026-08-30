const fs = require('fs');
const readline = require('readline');

// ── CONFIG ──────────────────────────────────────────────
const WALLET_FILE = 'wallet.txt';
const USN_FILE    = 'usn1.txt';
const DELAY_MS    = 1500;
const EXEC_URL    = 'https://script.google.com/macros/s/AKfycbx9Uzag0w0LZ-VE_FznrsdOS_fbzC5Q_TgU0Gb7RLo4oCDJD6gvJQHIHGEnJBgTDoMH/exec';
// ────────────────────────────────────────────────────────

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, resolve));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Generate status ID: "20" + 16 digit random
function randomStatusId() {
  let digits = '';
  for (let i = 0; i < 17; i++) digits += Math.floor(Math.random() * 10);
  return '20' + digits;
}

function buildReplyLink(usn) {
  const clean = usn.startsWith('@') ? usn.slice(1) : usn;
  return `https://x.com/${clean}/status/${randomStatusId()}?s=20`;
}

async function postExec(wallet, usn, lineNum) {
  const xUsername  = usn.startsWith('@') ? usn : '@' + usn;
  const replyLink  = buildReplyLink(usn);
  const body       = JSON.stringify({ xUsername, replyLink, wallet });

  try {
    const res = await fetch(EXEC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Origin':       'https://hornheads.xyz',
        'Referer':      'https://hornheads.xyz/',
      },
      body,
      redirect: 'follow',
    });

    const text = await res.text();
    const preview = text.slice(0, 80).replace(/\n/g, ' ');
    console.log(`[${lineNum}] ${res.status} | ${xUsername} | ${wallet.slice(0, 10)}... | ${preview}`);
  } catch (err) {
    console.log(`[${lineNum}] ✗ ERROR | ${usn} | ${err.message}`);
  }
}

(async () => {
  for (const f of [WALLET_FILE, USN_FILE]) {
    if (!fs.existsSync(f)) {
      console.error(`[ERROR] File "${f}" tidak ditemukan.`);
      process.exit(1);
    }
  }

  const wallets = fs.readFileSync(WALLET_FILE, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean);
  const usns    = fs.readFileSync(USN_FILE, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean);

  const total = Math.min(wallets.length, usns.length);
  console.log(`wallet.txt: ${wallets.length} | usn1.txt: ${usns.length} | Pasangan valid: ${total}\n`);

  console.log('Pilih mode:');
  console.log('  1) Dari awal sampai akhir');
  console.log('  2) Dari baris X sampai akhir');
  console.log('  3) Dari baris X sampai baris Y\n');

  const mode = (await ask('Pilih (1/2/3): ')).trim();

  let startIdx = 0;
  let endIdx   = total;

  if (mode === '2') {
    const x = parseInt((await ask(`Mulai dari baris (1-${total}): `)).trim(), 10);
    startIdx = x - 1;
  } else if (mode === '3') {
    const x = parseInt((await ask(`Mulai dari baris (1-${total}): `)).trim(), 10);
    const y = parseInt((await ask(`Sampai baris (1-${total}): `)).trim(), 10);
    startIdx = x - 1;
    endIdx   = y;
  }

  rl.close();

  if (startIdx < 0 || startIdx >= total || endIdx <= startIdx || endIdx > total) {
    console.error('[ERROR] Range tidak valid.');
    process.exit(1);
  }

  console.log(`\nMemproses baris ${startIdx + 1} sampai ${endIdx} (${endIdx - startIdx} entri)\n`);

  for (let i = startIdx; i < endIdx; i++) {
    await postExec(wallets[i], usns[i], i + 1);
    if (i < endIdx - 1) await sleep(DELAY_MS);
  }

  console.log('\n[DONE]');
})();
