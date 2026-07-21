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

const usns    = loadFile('usn.txt');
const wallets = loadFile('wallet.txt');

(async () => {
  for (let i = 0; i < Math.min(usns.length, wallets.length); i++) {
    const usn    = usns[i].replace('@', '');
    const handle = `@${usn}`;
    const wallet = wallets[i];

    try {
      const getRes = await fetch('https://lootersnft.xyz/whitelist/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36' }
      });

      const html   = await getRes.text();
      const match  = html.match(/name="csrf"\s+value="([^"]+)"/);
      const csrf   = match ? match[1] : '';
      const cookie = (getRes.headers.get('set-cookie') || '').split(';')[0];

      if (!csrf) {
        console.log(`[${i+1}] ⚠️  CSRF tidak ditemukan | ${handle}`);
        continue;
      }

      const proofPost    = genTweetUrl(usn);
      const proofComment = genTweetUrl(usn);

      const params = new URLSearchParams();
      params.append('csrf',      csrf);
      params.append('website',   '');
      params.append('proof[4]',  proofPost);
      params.append('proof[5]',  proofComment);
      params.append('handle',    handle);
      params.append('wallet',    wallet);

      const postRes = await fetch('https://lootersnft.xyz/whitelist/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin':       'https://lootersnft.xyz',
          'Referer':      'https://lootersnft.xyz/whitelist/',
          'Cookie':       cookie,
          'User-Agent':   'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36'
        },
        body: params
      });

      console.log(`[${i+1}] ${postRes.status === 200 ? '✅' : '❌'} ${handle} | ${wallet} | status ${postRes.status}`);
      console.log(`       post    : ${proofPost}`);
      console.log(`       comment : ${proofComment}`);

    } catch (e) {
      console.log(`[${i+1}] ERROR ${handle} | ${e.message}`);
    }

    if (i < usns.length - 1) await sleep(10000);
  }

  console.log('\nDone.');
})();
