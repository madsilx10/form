const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

const CLIENT_ID = 'ZUdzVWNleXlocjZJaFlfRFJ2SzI6MTpjaQ';
const REDIRECT_URI = 'https://h00dr00st.xyz/api/auth/x/callback';
const SCOPE = 'users.read tweet.read';
const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const AKUN_FILE = 'akun.txt'; // format per blok (pisah baris kosong): authtoken lalu ct0
const WALLET_FILE = 'wallet.txt';
const RESUME_FILE = 'resume_h00dr00st.json';
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
  return fs.readFileSync(path, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean);
}

function loadAccountBlocks() {
  if (!fs.existsSync(AKUN_FILE)) {
    console.error(`File ${AKUN_FILE} tidak ditemukan.`);
    process.exit(1);
  }
  const content = fs.readFileSync(AKUN_FILE, 'utf-8');
  const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  return blocks.map((block, i) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      console.error(`Blok ke-${i + 1} di ${AKUN_FILE} tidak lengkap (butuh authtoken + ct0).`);
      process.exit(1);
    }
    return { authToken: lines[0], ct0: lines[1] };
  });
}

function loadAccounts() {
  const accBlocks = loadAccountBlocks();
  const wallets = readLines(WALLET_FILE);

  if (accBlocks.length !== wallets.length) {
    console.error(`Jumlah akun di ${AKUN_FILE} (${accBlocks.length}) dan ${WALLET_FILE} (${wallets.length}) tidak sama.`);
    process.exit(1);
  }

  return accBlocks.map((acc, i) => ({ ...acc, wallet: wallets[i] }));
}

function loadResume() {
  if (fs.existsSync(RESUME_FILE)) return JSON.parse(fs.readFileSync(RESUME_FILE, 'utf-8'));
  return {};
}
function saveResume(resume) {
  fs.writeFileSync(RESUME_FILE, JSON.stringify(resume, null, 2));
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePKCE() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function baseCookie(authToken, ct0) {
  return `auth_token=${authToken}; ct0=${ct0}`;
}

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function safeJson(res, label) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label} - respons bukan JSON (status ${res.status}): ${text.slice(0, 150)}`);
  }
}

// Step 1: GET authorize -> dapat auth_code + info app
async function getAuthCode({ authToken, ct0, challenge, state }) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    state,
  });

  const url = `https://x.com/i/api/2/oauth2/authorize?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...COMMON_HEADERS,
      Authorization: `Bearer ${BEARER}`,
      Cookie: baseCookie(authToken, ct0),
      Referer: url,
      'X-Csrf-Token': ct0,
      'X-Twitter-Active-User': 'yes',
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Client-Language': 'en',
    },
  });

  const data = await safeJson(res, 'getAuthCode');
  if (!data.auth_code) throw new Error(`gagal ambil auth_code: ${JSON.stringify(data)}`);
  return data.auth_code;
}

// Step 2: POST authorize (approval) -> dapat code buat callback
async function approveAuthCode({ authToken, ct0, authCode }) {
  const body = new URLSearchParams({ approval: 'true', code: authCode });

  const res = await fetch('https://x.com/i/api/2/oauth2/authorize', {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      Authorization: `Bearer ${BEARER}`,
      Cookie: baseCookie(authToken, ct0),
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://x.com/i/oauth2/authorize',
      'X-Csrf-Token': ct0,
      'X-Twitter-Active-User': 'yes',
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Client-Language': 'en',
    },
    body: body.toString(),
  });

  const data = await safeJson(res, 'approveAuthCode');

  let code = data.code;
  let stateFromRedirect = null;
  if (!code && data.redirect_uri) {
    const redirectUrl = new URL(data.redirect_uri);
    code = redirectUrl.searchParams.get('code');
    stateFromRedirect = redirectUrl.searchParams.get('state');
  }

  if (!code) throw new Error(`gagal approve: ${JSON.stringify(data)}`);
  return { code, state: stateFromRedirect };
}

// Step 3: hit callback situs -> dapat session cookie situs
async function siteCallback({ code, state }) {
  const params = new URLSearchParams({ code, state });
  const res = await fetch(`${REDIRECT_URI}?${params.toString()}`, {
    method: 'GET',
    redirect: 'manual',
  });

  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, setCookie };
}

async function connectX(account) {
  const { verifier, challenge } = generatePKCE();
  const state = base64url(crypto.randomBytes(16));

  const authCode = await getAuthCode({ ...account, challenge, state });
  const { code, state: returnedState } = await approveAuthCode({ ...account, authCode });
  const { status, setCookie } = await siteCallback({ code, state: returnedState || state });

  return { status, siteCookie: setCookie };
}

function extractCookieValue(setCookieHeader, name) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function applyTask(account, siteCookieHeader) {
  const handle = extractCookieValue(siteCookieHeader, 'x_handle');
  if (!handle) throw new Error(`x_handle tidak ditemukan di cookie: ${siteCookieHeader}`);

  const res = await fetch('https://h00dr00st.xyz/api/allowlist', {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/json',
      Origin: 'https://h00dr00st.xyz',
      Referer: 'https://h00dr00st.xyz/',
      Cookie: `x_handle=${handle}`,
    },
    body: JSON.stringify({ handle, wallet: account.wallet }),
  });

  const data = await safeJson(res, 'applyTask');
  if (!data.ok) throw new Error(`gagal apply: ${JSON.stringify(data)}`);
  return data;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
}

async function selectAccounts(total) {
  console.log('\n1. 1 akun\n2. Semua akun\n3. From x to end\n');
  const mode = await ask('Pilihan (1/2/3): ');

  if (mode === '1') {
    const num = await ask(`Nomor akun (1-${total}): `);
    const idx = parseInt(num, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= total) { console.error('Nomor tidak valid.'); process.exit(1); }
    return [idx];
  }
  if (mode === '2') return Array.from({ length: total }, (_, i) => i);
  if (mode === '3') {
    const from = await ask(`Mulai dari nomor (1-${total}): `);
    const start = parseInt(from, 10) - 1;
    if (Number.isNaN(start) || start < 0 || start >= total) { console.error('Nomor tidak valid.'); process.exit(1); }
    return Array.from({ length: total - start }, (_, i) => start + i);
  }
  console.error('Pilihan tidak valid.');
  process.exit(1);
}

async function main() {
  const accounts = loadAccounts();
  if (accounts.length === 0) { console.error('Tidak ada akun.'); return; }

  const indices = await selectAccounts(accounts.length);
  const selected = indices.map((i) => accounts[i]);
  const resume = loadResume();

  for (let i = 0; i < selected.length; i++) {
    const acc = selected[i];
    const key = acc.authToken.slice(0, 10);

    if (resume[key]?.ok) {
      console.log(`[SKIP] akun ${i + 1} sudah berhasil`);
      continue;
    }

    process.stdout.write(`[PROSES] akun ${i + 1} - connect X ... `);

    try {
      const { status, siteCookie } = await connectX(acc);
      console.log(`connected (status ${status})`);

      process.stdout.write(`[PROSES] akun ${i + 1} - apply task ... `);
      const result = await applyTask(acc, siteCookie);
      console.log('OK');
      resume[key] = { ok: true, result };
    } catch (err) {
      console.log(`ERROR - ${err.message}`);
      resume[key] = { ok: false, error: err.message };
    }

    saveResume(resume);
    if (i !== selected.length - 1) await sleep(randomDelay());
  }

  console.log('\nSelesai. Hasil tersimpan di ' + RESUME_FILE);
}

main();
