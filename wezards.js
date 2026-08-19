const fs       = require("fs");
const readline = require("readline");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE_URL = "https://www.wezards.xyz";
const DELAY_MS = 2500;

// Endpoint math challenge — cek network tab kalau beda
const MATH_CHALLENGE_ENDPOINT = `${BASE_URL}/api/math-challenge`;
// ──────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readLines(file) {
  return fs
    .readFileSync(file, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

// Link random: 20 + 17 digit random
function randomLink(handle) {
  const clean  = handle.replace("@", "");
  const suffix = Array.from({ length: 17 }, () => Math.floor(Math.random() * 10)).join("");
  return `https://x.com/${clean}/status/20${suffix}?s=20`;
}

// Fetch task IDs dinamis, urutkan by sortOrder
async function getTasks() {
  const res  = await fetch(`${BASE_URL}/api/tasks`);
  const json = await res.json();
  return json.tasks
    .filter((t) => t.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// Fetch math challenge & decode jawaban dari base64
// Format decoded: "9:+:8:17:timestamp:hash"
// answer = parts[3]
async function getMathChallenge() {
  const res  = await fetch(MATH_CHALLENGE_ENDPOINT);
  const json = await res.json();

  const challengeId = json.challengeId || json.id || json.mathChallengeId;
  if (!challengeId) throw new Error(`Math challenge response unexpected: ${JSON.stringify(json)}`);

  const decoded = Buffer.from(challengeId, "base64").toString("utf-8");
  const parts   = decoded.split(":");

  // parts: [num1, op, num2, answer, timestamp, hash]
  const answer = parts[3];
  if (!answer || isNaN(parseInt(answer))) {
    throw new Error(`Gagal parse jawaban dari: ${decoded}`);
  }

  return { mathChallengeId: challengeId, mathAnswer: answer };
}

async function submit(wallet, handle, tasks, math) {
  const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const replyLink   = randomLink(handle);

  // task[0] = follow → proof: handle
  // task[1] = repost → proof: link
  const completedTaskIds = tasks.map((t) => t.id);
  const taskProofs = {
    [tasks[0].id]: cleanHandle,
    [tasks[1].id]: replyLink,
  };

  const body = JSON.stringify({
    walletAddress     : wallet,
    twitterUsername   : cleanHandle,
    replyCommentLink  : replyLink,
    email             : "",
    completedTaskIds,
    mathChallengeId   : math.mathChallengeId,
    mathAnswer        : math.mathAnswer,
    taskProofs,
  });

  const res = await fetch(`${BASE_URL}/api/whitelist/submit`, {
    method  : "POST",
    headers : { "Content-Type": "application/json" },
    body,
  });

  return await res.json();
}

async function main() {
  const handles = readLines("usn1.txt");
  const wallets = readLines("wallet.txt");
  const maxLen  = Math.min(handles.length, wallets.length);

  if (handles.length !== wallets.length) {
    console.warn(`⚠  jumlah beda: ${handles.length} handle vs ${wallets.length} wallet → pakai ${maxLen} akun\n`);
  }

  console.log(`📋 Total akun tersedia: ${maxLen}\n`);

  const rl      = readline.createInterface({ input: process.stdin, output: process.stdout });
  const rawFrom = await ask(rl, `Dari akun ke berapa? (1–${maxLen}): `);
  const rawTo   = await ask(rl, `Sampai akun ke berapa? (1–${maxLen}): `);
  rl.close();

  const argFrom = parseInt(rawFrom);
  const argTo   = parseInt(rawTo);
  const start   = Math.max(1, argFrom) - 1;
  const end     = Math.min(argTo, maxLen);
  const total   = end - start;

  if (total <= 0) {
    console.error(`❌ Range invalid: ${argFrom}–${argTo}`);
    process.exit(1);
  }

  // Fetch task IDs sekali aja
  process.stdout.write("⏳ Fetch task IDs... ");
  const tasks = await getTasks();
  console.log(`✅ ${tasks.length} task ditemukan`);
  tasks.forEach((t) => console.log(`   [${t.sortOrder}] ${t.type} → ${t.id}`));
  console.log();

  console.log(`🚀 Submit akun ${argFrom}–${end} (${total} akun)...\n`);

  let ok = 0, fail = 0;

  for (let i = start; i < end; i++) {
    const handle = handles[i];
    const wallet = wallets[i];
    const num    = i - start + 1;

    process.stdout.write(`[${num}/${total}] akun#${i + 1} @${handle} | ${wallet.slice(0, 10)}... → `);

    try {
      // Fresh math challenge tiap akun
      const math   = await getMathChallenge();
      const result = await submit(wallet, handle, tasks, math);

      if (result.success) {
        console.log(`✅ ${result.message} | ID: ${result.entryId}`);
        ok++;
      } else {
        console.log(`❌ FAILED | ${JSON.stringify(result)}`);
        fail++;
      }
    } catch (err) {
      console.log(`💥 ERROR | ${err.message}`);
      fail++;
    }

    if (i < end - 1) await sleep(DELAY_MS);
  }

  console.log(`\n📊 Done: ${ok} berhasil, ${fail} gagal dari ${total} akun.`);
}

main();
