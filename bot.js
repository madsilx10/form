const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URLSearchParams, URL } = require('url');
const { HttpsProxyAgent } = require('https-proxy-agent');

// ===== KONFIGURASI =====
const TARGET_HANDLE = 'noirbrokers_rh'; // handle target (tanpa @)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyfFpkBgZ4GFjzpJZxbAsjEHjUDPlV3Y8VJAMUZfRQzv47YbfHk8aX2wE8wv_7lBnhv4Q/exec';
const DELAY_MS = 3000;
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Infinix X6833B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.183 Mobile Safari/537.36';
const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I7ssbmtoJ0k%3DEUifiRBkKG5E2XYMLgk93Ia8wZiKMPEXCLxt';
// Pola nama file proxy yang otomatis ke-detect (case-insensitive), format tiap baris: ip:port:user:pass
const PROXY_FILE_PATTERN = /^webshare.*proxies.*\.txt$/i;
// =======================

// Format file:
// usn.txt  → satu username per baris (@handle) — jadi twitterId & username
// wallet.txt → satu wallet per baris
// akun.txt → pasangan per akun, no blank line:
//   authtoken1
//   ct0_1
//   authtoken2
//   ct0_2
// Webshare_10_proxies*.txt → satu proxy per baris, format ip:port:user:pass
//   (boleh beberapa file, semua digabung jadi satu pool)

function readLines(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').map(l => l.trim()).filter(Boolean);
}

// Cari & gabungin semua file proxy yang match pattern di cwd, lalu parse
function loadProxies() {
  const files = fs.readdirSync('.').filter(f => PROXY_FILE_PATTERN.test(f));
  const proxies = [];
  for (const f of files) {
    for (const line of readLines(f)) {
      const parts = line.split(':');
      if (parts.length < 2) continue;
      const [ip, port, user, pass] = parts;
      const auth = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
      proxies.push({ raw: line, url: `http://${auth}${ip}:${port}`, ip, port });
    }
  }
  return proxies;
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
      agent: options.agent, // proxy agent (kalau ada), undefined = koneksi langsung
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const loc = res.headers.location;
        const nextUrl = loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.host}${loc}`;
        const nextMethod = [307, 308].includes(res.statusCode) ? (options.method || 'GET') : 'GET';
        httpRequest(nextUrl, { method: nextMethod, headers: options.headers || {}, agent: options.agent }, nextMethod !== 'GET' ? body : null, redirectCount + 1)
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

async function getIpInfo(agent) {
  try {
    const res = await httpRequest('http://ip-api.com/json/?fields=query,country', { agent });
    const d = JSON.parse(res.body);
    return { ip: d.query || '0.0.0.0', country: d.country || 'Unknown' };
  } catch {
    return { ip: '0.0.0.0', country: 'Unknown' };
  }
}

async function resolveUserId(handle, authtoken, ct0, agent) {
  const res = await httpRequest(`https://x.com/i/api/1.1/users/show.json?screen_name=${handle}`, {
    agent,
    headers: {
      'Authorization': `Bearer ${BEARER}`,
      'x-csrf-token': ct0,
      'Cookie': `auth_token=${authtoken}; ct0=${ct0}`,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
      'Referer': 'https://x.com/',
    },
  });
  const data = JSON.parse(res.body);
  if (!data.id_str) throw new Error(`Gagal resolve ID: ${res.body.slice(0, 80)}`);
  return data.id_str;
}

async function twitterFollow(authtoken, ct0, userId, agent) {
  const body = new URLSearchParams({ user_id: userId, include_following_count: '1' }).toString();
  return httpRequest('https://x.com/i/api/1.1/friendships/create.json', {
    method: 'POST',
    agent,
    headers: {
      'Authorization': `Bearer ${BEARER}`,
      'x-csrf-token': ct0,
      'Cookie': `auth_token=${authtoken}; ct0=${ct0}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
      'Referer': 'https://x.com/',
    },
  }, body);
}

async function submitGas(twitterId, username, wallet, ip, country, agent) {
  const payload = JSON.stringify({ twitterId, username, wallet, ip, country, userAgent: USER_AGENT });
  return httpRequest(GAS_URL, {
    method: 'POST',
    agent,
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

  // Load pool proxy (gabungan semua file Webshare_10_proxies*.txt)
  const proxies = loadProxies();
  if (proxies.length === 0) {
    console.log('[!] Tidak ada file proxy terdeteksi, jalan tanpa proxy (IP lokal).\n');
  } else {
    console.log(`[*] ${proxies.length} proxy terdeteksi, rotasi round-robin per akun.\n`);
  }

  // Pilih range akun
  const { start, end } = await selectRange(total);
  const rangeCount = end - start + 1;
  console.log(`\n[*] Akun yang diproses: ${rangeCount} (no. ${start + 1} - ${end + 1})`);

  // Resolve ID target sekali di awal (userId sama buat semua akun)
  // Coba beberapa akun di range kalau token akun pertama expired/invalid
  let targetUserId = null;
  for (let t = start; t <= end && targetUserId === null; t++) {
    try {
      const tryAgent = proxies.length ? new HttpsProxyAgent(proxies[t % proxies.length].url) : undefined;
      targetUserId = await resolveUserId(TARGET_HANDLE, accounts[t].authtoken, accounts[t].ct0, tryAgent);
      console.log(`[*] Target @${TARGET_HANDLE} → ID: ${targetUserId} (pakai akun #${t + 1})\n`);
    } catch (e) {
      console.log(`[!] Akun #${t + 1} gagal resolve target: ${e.message}`);
    }
  }
  if (targetUserId === null) {
    console.log(`[!] Semua akun gagal resolve ID target, follow bakal di-skip.\n`);
  }

  for (let i = start; i <= end; i++) {
    const handle = usernames[i].startsWith('@') ? usernames[i] : `@${usernames[i]}`;
    const wallet = wallets[i];
    const { authtoken, ct0 } = accounts[i];

    // Proxy giliran akun ini (round-robin dari pool)
    const proxy = proxies.length ? proxies[i % proxies.length] : null;
    const agent = proxy ? new HttpsProxyAgent(proxy.url) : undefined;

    console.log(`[${i - start + 1}/${rangeCount}] #${i + 1} ${handle}${proxy ? `  (proxy: ${proxy.ip}:${proxy.port})` : ''}`);

    const { ip, country } = await getIpInfo(agent);
    console.log(`  IP dipakai: ${ip} | Country: ${country}`);

    // === Auto Follow ===
    if (targetUserId) {
      try {
        const res = await twitterFollow(authtoken, ct0, targetUserId, agent);
        if (res.status === 200) {
          console.log(`  ✓ Follow OK @${TARGET_HANDLE}`);
        } else {
          console.log(`  ✗ Follow ${res.status}: ${res.body.slice(0, 60)}`);
        }
      } catch (e) {
        console.log(`  ✗ Follow error: ${e.message}`);
      }
    }

    // === Submit GAS ===
    try {
      const res = await submitGas(handle, handle, wallet, ip, country, agent);
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
