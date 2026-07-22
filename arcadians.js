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

const usns    = loadFile('usn1.txt');
const wallets = loadFile('wallet.txt');

(async () => {
  for (let i = 0; i < Math.min(usns.length, wallets.length); i++) {
    const usn    = usns[i];
    const wallet = wallets[i];

    const payload = {
      username: usn,
      postUrl:  genTweetUrl(usn),
      wallet:   wallet
    };

    try {
      const res  = await fetch('https://arcadiansnft.com/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      console.log(`[${i+1}] ${data.ok ? '✅' : '❌'} ${usn} | ${wallet} | appId: ${data.appId || '-'}`);
    } catch (e) {
      console.log(`[${i+1}] ERROR ${usn} | ${e.message}`);
    }

    if (i < usns.length - 1) await sleep(10000);
  }

  console.log('\nDone.');
})();
