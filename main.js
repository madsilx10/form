const fs = require("fs");

// ─── Helper ───────────────────────────────────────────────────────────────────
function readLines(file) {
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Project 1: Robin Broker WL ───────────────────────────────────────────────
async function robinWL() {
  const wallets = readLines("wallet.txt");
  const usernames = readLines("usn1.txt");
  const total = Math.min(wallets.length, usernames.length);

  const API_KEY = "sb_publishable_ez4VYBd3I6zN1o_D3paW8w_POIW1b5w";
  const URL = "https://enquztrtowvxxrvbuztz.supabase.co/rest/v1/whitelist_submissions";

  console.log(`\n=== ROBIN BROKER WL (${total} akun) ===`);

  for (let i = 0; i < total; i++) {
    const username = usernames[i];
    const wallet = wallets[i];

    const body = {
      x_username: username,
      evm_wallet: wallet.toLowerCase(),
      followed: true,
      liked: true,
      commented: true,
      reposted: true,
      source: "robin-broker-wl",
    };

    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: {
          "apikey": API_KEY,
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      const info = res.ok ? "" : ` | ${text}`;
      console.log(`[${i + 1}/${total}] @${username} | ${wallet.slice(0, 8)}... → ${res.status}${info}`);
    } catch (err) {
      console.log(`[${i + 1}/${total}] @${username} ERROR: ${err.message}`);
    }

    if (i < total - 1) await sleep(5000);
  }
}

// ─── Project 2: Allocofi Waitlist ─────────────────────────────────────────────
async function allocofi() {
  const emails = readLines("email.txt");
  const URL = "https://www.allocofi.com/api/waitlist";

  console.log(`\n=== ALLOCOFI WAITLIST (${emails.length} email) ===`);

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();
      const wlNum = json?.results?.waitlist_number ?? "-";
      console.log(`[${i + 1}/${emails.length}] ${email} → ${res.status} | waitlist #${wlNum}`);
    } catch (err) {
      console.log(`[${i + 1}/${emails.length}] ${email} ERROR: ${err.message}`);
    }

    if (i < emails.length - 1) await sleep(5000);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  await robinWL();
  await allocofi();
  console.log("\nDone.");
})();
