const fs = require('fs');

const wallets = fs.readFileSync('wallet.txt', 'utf8').trim().split('\n').map(l => l.trim()).filter(Boolean);
const handles = fs.readFileSync('usn1.txt', 'utf8').trim().split('\n').map(l => l.trim()).filter(Boolean);

const delay = ms => new Promise(r => setTimeout(r, ms));

async function join(handle, wallet) {
  const res = await fetch('https://boilerbrokers.xyz/api/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle, wallet })
  });
  const data = await res.json();
  return data;
}

(async () => {
  const count = Math.min(wallets.length, handles.length);

  for (let i = 0; i < count; i++) {
    const handle = handles[i];
    const wallet = wallets[i];
    try {
      const res = await join(handle, wallet);
      console.log(`[${i + 1}/${count}] ${handle} | ${wallet} => ${JSON.stringify(res)}`);
    } catch (e) {
      console.log(`[${i + 1}/${count}] ${handle} | ${wallet} => ERROR: ${e.message}`);
    }
    if (i < count - 1) await delay(1000);
  }
})();
