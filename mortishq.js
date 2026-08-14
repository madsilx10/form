const fs = require("fs");
const readline = require("readline");

// Load files
const wallets = fs.readFileSync("wallet.txt", "utf8").trim().split("\n").map(s => s.trim()).filter(Boolean);
const usns = fs.readFileSync("usn1.txt", "utf8").trim().split("\n").map(s => s.trim()).filter(Boolean);

if (wallets.length !== usns.length) {
  console.error(`❌ Jumlah wallet (${wallets.length}) dan usn (${usns.length}) tidak sama!`);
  process.exit(1);
}

const total = wallets.length;

function randomTweetId() {
  // Awalan "20" + 17 digit random
  const rest = Array.from({ length: 17 }, () => String(Math.floor(Math.random() * 10))).join("");
  return "20" + rest;
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function apply(usn, wallet, index) {
  const proofUrl = `https://x.com/${usn}/status/${randomTweetId()}?s=20`;

  const payload = {
    handle: usn,
    wallet: wallet,
    tasks: { follow: true, engage: true, comment: true },
    proofUrl: proofUrl,
  };

  try {
    const res = await fetch("https://mortishq.com/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.ok) {
      console.log(`[${index + 1}/${total}] ✅ ${usn} | ${wallet} | App#${data.applicationNumber}`);
    } else {
      console.log(`[${index + 1}/${total}] ❌ ${usn} | ${wallet} | ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`[${index + 1}/${total}] 💥 ${usn} | ${wallet} | Error: ${err.message}`);
  }
}

async function run(startIdx, endIdx) {
  console.log(`\n🚀 Submit akun ${startIdx + 1} - ${endIdx} dari total ${total}...\n`);
  for (let i = startIdx; i < endIdx; i++) {
    await apply(usns[i], wallets[i], i);
    if (i < endIdx - 1) {
      const delay = 1000 + Math.floor(Math.random() * 1000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  console.log("\n✅ Selesai!");
}

(async () => {
  console.log("╔══════════════════════════════╗");
  console.log("║     MortisHQ Auto Apply      ║");
  console.log(`║     Total akun: ${String(total).padEnd(13)}║`);
  console.log("╚══════════════════════════════╝");
  console.log("");
  console.log("Pilih mode:");
  console.log("  1. 1 akun saja (pilih nomor)");
  console.log("  2. Semua akun");
  console.log("  3. From X to end");
  console.log("");

  const mode = await prompt("Pilihan (1/2/3): ");

  if (mode === "1") {
    const input = await prompt(`Nomor akun (1 - ${total}): `);
    const num = parseInt(input);
    if (isNaN(num) || num < 1 || num > total) {
      console.error("❌ Nomor tidak valid!");
      process.exit(1);
    }
    await run(num - 1, num);

  } else if (mode === "2") {
    await run(0, total);

  } else if (mode === "3") {
    const input = await prompt(`Start dari nomor berapa? (1 - ${total}): `);
    const from = parseInt(input);
    if (isNaN(from) || from < 1 || from > total) {
      console.error("❌ Nomor tidak valid!");
      process.exit(1);
    }
    await run(from - 1, total);

  } else {
    console.error("❌ Pilihan tidak valid!");
    process.exit(1);
  }
})();
