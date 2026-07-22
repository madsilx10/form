const fs = require('fs');

function loadFile(filename) {
  return fs.readFileSync(filename, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const usns    = loadFile('usn.txt');
const wallets = loadFile('wallet.txt');

(async () => {
  for (let i = 0; i < Math.min(usns.length, wallets.length); i++) {
    const usn    = usns[i].startsWith('@') ? usns[i] : `@${usns[i]}`;
    const wallet = wallets[i];

    const payload = {
      xHandle:             usn,
      walletAddress:       wallet,
      community:           '',
      website:             '',
      followedConfirmed:   true,
      retweetedConfirmed:  true,
      commentedConfirmed:  true,
      commentCode:         'PORTAL4269'
    };

    try {
      const res  = await fetch('https://droupz.xyz/api/wl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':   'Mozilla/5.0 (Linux; Android 13; Infinix X6833B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.46 Mobile Safari/537.36',
          'Referer':      'https://droupz.xyz/#apply'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      console.log(`[${i+1}] ${data.ok ? '✅' : '❌'} ${usn} | ${wallet} | status ${res.status}`);
    } catch (e) {
      console.log(`[${i+1}] ERROR ${usn} | ${e.message}`);
    }

    if (i < usns.length - 1) await sleep(10000);
  }

  console.log('\nDone.');
})();
