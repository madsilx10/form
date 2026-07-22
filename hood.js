const fs = require('fs');

function loadFile(filename) {
  return fs.readFileSync(filename, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
}

function genTweetUrl(usn) {
  const randId = '20' + Array.from({length: 17}, () => Math.floor(Math.random() * 10)).join('');
  return `https://x.com/${usn}/status/${randId}?s=20`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const COLORS = ['Blue', 'Purple', 'Cyan', 'Yellow', 'Orange', 'Red', 'Green'];
const URL = 'https://script.google.com/macros/s/AKfycbxkcg6Ik_7WSS2ez_AuLrc-xzqb0jyfzH6P-dt339ncu7bKFKY8FgPUahnnbh8ngZXO3A/exec';

const usns    = loadFile('usn.txt');
const wallets = loadFile('wallet.txt');

(async () => {
  for (let i = 0; i < Math.min(usns.length, wallets.length); i++) {
    const usn    = usns[i].replace('@', '');
    const wallet = wallets[i];
    const color  = COLORS[Math.floor(Math.random() * COLORS.length)];

    const payload = {
      timestamp:    new Date().toISOString(),
      x_handle:     usn,
      wallet:       wallet,
      hoodie_color: color,
      followed:     true,
      liked_rt:     true,
      comment_url:  genTweetUrl(usn),
      user_agent:   'Mozilla/5.0 (Linux; Android 13; Infinix X6833B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.46 Mobile Safari/537.36',
      website:      '',
      __secret:     '',
      origin:       'https://hooddoods.xyz',
      referrer:     'https://hooddoods.xyz/'
    };

    try {
      const res  = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      console.log(`[${i+1}] ${data.ok ? '✅' : '❌'} @${usn} | ${wallet} | ${color}`);
      console.log(`       comment : ${payload.comment_url}`);
    } catch (e) {
      console.log(`[${i+1}] ERROR @${usn} | ${e.message}`);
    }

    if (i < usns.length - 1) await sleep(10000);
  }

  console.log('\nDone.');
})();
