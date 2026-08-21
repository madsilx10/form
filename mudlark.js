const fs = require('fs');
const readline = require('readline');

const WHITELIST_URL = 'https://www.mudlarknft.com/api/whitelist';
const TARGET_SCREEN_NAME = 'MUDLARK_nft';

// bearer web-client publik (dari referensi kupo-9-8.py, udah dicek bener)
const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

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

function xHeaders(acc, extra = {}) {
  return {
    'cookie': `auth_token=${acc.authToken}; ct0=${acc.ct0}`,
    'x-csrf-token': acc.ct0,
    'authorization': `Bearer ${BEARER}`,
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
    'referer': `https://x.com/${TARGET_SCREEN_NAME}`,
    'origin': 'https://x.com',
    ...extra,
  };
}

async function getTargetUserId(acc) {
  const variables = JSON.stringify({ screen_name: TARGET_SCREEN_NAME, withGrokTranslatedBio: true });
  const features = JSON.stringify({
    hidden_profile_subscriptions_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  });
  const fieldToggles = JSON.stringify({ withAuxiliaryUserLabels: true });
  const params = new URLSearchParams({ variables, features, fieldToggles });
  const url = `https://x.com/i/api/graphql/2qvSHpkWTMS9i0zJAwDNiA/UserByScreenName?${params}`;

  const res = await fetch(url, { headers: xHeaders(acc) });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }

  if (res.status === 401) throw new Error('Token invalid/expired (401) saat lookup target.');
  const uid = data?.data?.user?.result?.rest_id;
  if (!uid) throw new Error(`Gagal lookup @${TARGET_SCREEN_NAME}: ${JSON.stringify(data).slice(0, 200)}`);
  return uid;
}

async function followTarget(acc) {
  const targetId = await getTargetUserId(acc);
  const url = `https://x.com/i/api/1.1/friendships/create.json?user_id=${targetId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: xHeaders(acc, { 'content-type': 'application/x-www-form-urlencoded' }),
  });

  if (res.status === 403) {
    // udah follow duluan
    return { status: 200, data: { already: true } };
  }

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
