const fs = require('fs');
const https = require('https');
const http = require('http');
const { URLSearchParams, URL } = require('url');

// ===== KONFIGURASI =====
const TARGET_HANDLE = 'noirbrokers_rh'; // handle target (tanpa @)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyfFpkBgZ4GFjzpJZxbAsjEHjUDPlV3Y8VJAMUZfRQzv47YbfHk8aX2wE8wv_7lBnhv4Q/exec';
const DELAY_MS = 3000;
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Infinix X6833B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.183 Mobile Safari/537.36';
const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I7ssbmtoJ0k%3DEUifiRBkKG5E2XYMLgk93Ia8wZiKMPEXCLxt';
// =======================

// Format file:
// usn.txt  → satu username per baris (@handle) — jadi twitterId & username
// wallet.txt → satu wallet per baris
// akun.txt → pasangan per akun, no blank line:
//   authtoken1
//   ct0_1
//   authtoken2
//   ct0_2

function readLines(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').map(l => l.trim()).filter(Boolean);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpRequest(urlStr, options = {}, body = null, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));

    let parsed;
    try { parsed = new URL(urlStr); }
    catch (e) { return reject(e); }

    const mod = parsed.protocol === 'https:' ? https : http;
    const headers = { 'User-Agent': USER_AGENT, ...(options.headers || {}) };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: options.method || 'GET',
      headers,
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const loc = res.headers.location;
        const nextUrl = loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.host}${loc}`;
        const nextMethod = [307, 308].includes(res.statusCode) ? (options.method || 'GET') : 'GET';
        httpRequest(nextUrl, { method: nextMethod, headers: {} }, nextMethod !== 'GET' ? body : null, redirectCount + 1)
          .then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getIpInfo() {
  try {
    const res = await httpRequest('http://ip-api.com/json/?fields=query,country');
    const d = JSON.parse(res.body);
    return { ip: d.query || '0.0.0.0', country: d.country || 'Unknown' };
  } catch {
    return { ip: '0.0.0.0', country: 'Unknown' };
  }
}

async function resolveUserId(handle, authtoken, ct0) {
  const res = await httpRequest(`https://api.twitter.com/1.1/users/show.json?screen_name=${handle}`, {
    headers: {
      'Authorization': `Bearer ${BEARER}`,
      'x-csrf-token': ct0,
      'Cookie': `auth_token=${authtoken}; ct0=${ct0}`,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
    },
  });
  const data = JSON.parse(res.body);
  if (!data.id_str) throw new Error(`Gagal resolve ID: ${res.body.slice(0, 80)}`);
  return data.id_str;
}

async function twitterFollow(authtoken, ct0, userId) {
  const body = new URLSearchParams({ user_id: userId, include_following_count: '1' }).toString();
  return httpRequest('https://twitter.com/i/api/1.1/friendships/create.json', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BEARER}`,
      'x-csrf-token': ct0,
      'Cookie': `auth_token=${authtoken}; ct0=${ct0}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
      'Referer': 'https://twitter.com/',
    },
  }, body);
}

async function submitGas(twitterId, username, wallet, ip, country) {
  const payload = JSON.stringify({ twitterId, username, wallet, ip, country, userAgent: USER_AGENT });
  return httpRequest(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  }, payload);
}

function prompt(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    process.stdin.once('data', d => resolve(d.toString().trim()));
  });
}

async function selectRange(total) {
  console.log(`\nTotal akun: ${total}`);
  console.log('  [1] Satu akun');
  console.log('  [2] Semua akun');
  console.log('  [3] Dari akun X sampai akhir');
  const choice = await prompt('Pilih [1/2/3]: ');

  if (choice === '1') {
    const n = parseInt(await prompt(`Nomor akun (1-${total}): `));
    if (isNaN(n) || n < 1 || n > total) { console.error('[!] Nomor tidak valid'); process.exit(1); }
    return { start: n - 1, end: n - 1 };
  } else if (choice === '2') {
    return { start: 0, end: total - 1 };
  } else if (choice === '3') {
    const n = parseInt(await prompt(`Mulai dari akun nomor (1-${total}): `));
    if (isNaN(n) || n < 1 || n > total) { console.error('[!] Nomor tidak valid'); process.exit(1); }
    return { start: n - 1, end: total - 1 };
  } else {
    console.error('[!] Pilihan tidak valid');
    process.exit(1);
  }
}

async function main() {
  const usernames = readLines('usn.txt');
  const wallets   = readLines('wallet.txt');
  const akunLines = readLines('akun.txt');

  const accounts = [];
  for (let i = 0; i + 1 < akunLines.length; i += 2) {
    accounts.push({ authtoken: akunLines[i], ct0: akunLines[i + 1] });
  }

  const total = Math.min(accounts.length, usernames.length, wallets.length);
  if (total === 0) {
    console.error('[!] File kosong atau format salah');
    process.exit(1);
  }

  // Pilih range akun
  const { start, end } = await selectRange(total);
  const rangeCount = end - start + 1;
  console.log(`\n[*] Akun yang diproses: ${rangeCount} (no. ${start + 1} - ${end + 1})`);

  // Auto-resolve numeric ID dari handle target
  process.stdout.write(`[*] Resolving @${TARGET_HANDLE}... `);
  let TARGET_USER_ID;
  try {
    TARGET_USER_ID = await resolveUserId(TARGET_HANDLE, accounts[start].authtoken, accounts[start].ct0);
    console.log(`ID: ${TARGET_USER_ID}`);
  } catch (e) {
    console.log(`GAGAL: ${e.message}`);
    process.exit(1);
  }

  const { ip, country } = await getIpInfo();
  console.log(`[*] IP: ${ip} | Country: ${country}\n`);

  for (let i = start; i <= end; i++) {
    const { authtoken, ct0 } = accounts[i];
    const handle = usernames[i].startsWith('@') ? usernames[i] : `@${usernames[i]}`;
    const wallet = wallets[i];

    console.log(`[${i - start + 1}/${rangeCount}] #${i + 1} ${handle}`);

    // === Twitter Follow ===
    try {
      const res = await twitterFollow(authtoken, ct0, TARGET_USER_ID);
      let parsed = {};
      try { parsed = JSON.parse(res.body); } catch {}

      if (res.status === 200 && parsed.id) {
        console.log(`  ✓ Follow sukses (@${parsed.screen_name})`);
      } else if (parsed.errors?.length) {
        const e = parsed.errors[0];
        // 160 = already following, bukan error fatal
        const label = e.code === 160 ? '~ Sudah follow' : `✗ Gagal [${e.code}]`;
        console.log(`  ${label}: ${e.message}`);
      } else {
        console.log(`  ? Follow ${res.status}: ${res.body.slice(0, 80)}`);
      }
    } catch (e) {
      console.log(`  ✗ Follow error: ${e.message}`);
    }

    // === Submit GAS ===
    try {
      const res = await submitGas(handle, handle, wallet, ip, country);
      if (res.status === 200) {
        console.log(`  ✓ Submit OK: ${res.body.slice(0, 80)}`);
      } else {
        console.log(`  ✗ Submit ${res.status}: ${res.body.slice(0, 60)}`);
      }
    } catch (e) {
      console.log(`  ✗ Submit error: ${e.message}`);
    }

    if (i < end) {
      process.stdout.write(`  ⏳ ${DELAY_MS / 1000}s delay...\n\n`);
      await sleep(DELAY_MS);
    }
  }

  console.log('\n[✓] Selesai');
  process.stdin.destroy();
}

main().catch(e => {
  console.error('[!] Fatal:', e.message);
  process.exit(1);
});
