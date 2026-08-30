const fs = require('fs');
const readline = require('readline');

// ── CONFIG ──────────────────────────────────────────────
const EMAIL_FILE   = 'email.txt';
const WAITLIST_ID  = 32223;
const REFERRAL     = 'https://chomp.fyi/';
const DELAY_MS     = 1000; // jeda antar request (ms)
// ────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, resolve));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function register(email, lineNum) {
  try {
    const res = await fetch('https://api.getwaitlist.com/api/v1/waiter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, waitlist_id: WAITLIST_ID, referral_link: REFERRAL }),
    });

    const data = await res.json();

    if (res.ok) {
      console.log(`[${lineNum}] ✓ ${email} | priority: ${data.priority} | ref: ${data.referral_link}`);
    } else {
      console.log(`[${lineNum}] ✗ ${email} | ${res.status} | ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`[${lineNum}] ✗ ${email} | ERROR: ${err.message}`);
  }
}

(async () => {
  if (!fs.existsSync(EMAIL_FILE)) {
    console.error(`[ERROR] File "${EMAIL_FILE}" tidak ditemukan.`);
    process.exit(1);
  }

  const emails = fs
    .readFileSync(EMAIL_FILE, 'utf-8')
    .split('\n')
    .map(e => e.trim())
    .filter(Boolean);

  console.log(`Total email di ${EMAIL_FILE}: ${emails.length}\n`);
  console.log('Pilih mode:');
  console.log('  1) Dari awal sampai akhir');
  console.log('  2) Dari baris X sampai akhir');
  console.log('  3) Dari baris X sampai baris Y\n');

  const mode = (await ask('Pilih (1/2/3): ')).trim();

  let startIdx = 0;
  let endIdx = emails.length;

  if (mode === '2') {
    const x = parseInt((await ask(`Mulai dari baris (1-${emails.length}): `)).trim(), 10);
    startIdx = x - 1;
  } else if (mode === '3') {
    const x = parseInt((await ask(`Mulai dari baris (1-${emails.length}): `)).trim(), 10);
    const y = parseInt((await ask(`Sampai baris (1-${emails.length}): `)).trim(), 10);
    startIdx = x - 1;
    endIdx = y;
  }

  rl.close();

  if (startIdx < 0 || startIdx >= emails.length || endIdx <= startIdx || endIdx > emails.length) {
    console.error('[ERROR] Range tidak valid.');
    process.exit(1);
  }

  const queue = emails.slice(startIdx, endIdx);
  console.log(`\nMemproses baris ${startIdx + 1} sampai ${endIdx} (${queue.length} email)\n`);

  for (let i = 0; i < queue.length; i++) {
    const lineNum = startIdx + i + 1;
    await register(queue[i], lineNum);
    if (i < queue.length - 1) await sleep(DELAY_MS);
  }
  console.log('\n[DONE]');
})();
