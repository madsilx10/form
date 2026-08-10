const fs = require('fs');

const EMAIL_FILE = 'email.txt';
const URL = 'https://api.bitrobot.ai/public/launch-access';

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function randomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadEmails() {
  return fs.readFileSync(EMAIL_FILE, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

async function submit(email) {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status === 'success') {
      console.log(`[OK] ${email}`);
    } else {
      console.log(`[FAIL] ${email} -> ${res.status} ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`[ERROR] ${email} -> ${err.message}`);
  }
}

async function main() {
  const emails = loadEmails();
  console.log(`Total email: ${emails.length}`);

  for (const email of emails) {
    await submit(email);
    const d = randomDelay();
    console.log(`  delay ${d}ms...`);
    await delay(d);
  }

  console.log('Selesai.');
}

main();
