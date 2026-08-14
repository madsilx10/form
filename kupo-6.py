import asyncio
import json
import random
import secrets
import sys
from pathlib import Path
from typing import Optional
from curl_cffi.requests import AsyncSession

# ── CONFIG ────────────────────────────────────────────────────────────────────
TWEET_ID         = "2088273829756100667"
FOLLOW_TARGET    = "KupoNFTs"
BASE_URL         = "https://www.kupo.world/api"

DELAY_MIN = 10
DELAY_MAX = 30

# ── STATE ─────────────────────────────────────────────────────────────────────
STATE_FILE = Path("done.json")

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            return {}
    return {}

def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2))

def is_done(state: dict, key: str, task: str) -> bool:
    return state.get(key, {}).get(task, False)

def mark_done(state: dict, key: str, task: str):
    if key not in state:
        state[key] = {}
    state[key][task] = True
    save_state(state)

# ── LOAD AKUN ─────────────────────────────────────────────────────────────────
def sanitize(s: str) -> str:
    if not s:
        return s
    return s.replace("\u200b", "").replace("\u200c", "").replace("\u200d", "") \
            .replace("\ufeff", "").replace("\u00a0", "").strip()

def load_accounts() -> list:
    usn     = Path("usn1.txt").read_text(encoding="utf-8").strip().splitlines()
    wallets = Path("wallet.txt").read_text(encoding="utf-8").strip().splitlines()
    raw     = Path("akun.txt").read_text(encoding="utf-8").strip().split("\n\n")

    usn     = [s.strip() for s in usn if s.strip()]
    wallets = [s.strip() for s in wallets if s.strip()]
    akuns   = []
    for block in raw:
        lines = [s.strip() for s in block.strip().splitlines() if s.strip()]
        if len(lines) >= 2:
            akuns.append({"auth_token": sanitize(lines[0]), "ct0": sanitize(lines[1])})

    print(f"📊 usn1.txt: {len(usn)} | wallet.txt: {len(wallets)} | akun.txt: {len(akuns)}")
    if not (len(usn) == len(wallets) == len(akuns)):
        print("⚠️  JUMLAH GAK SAMA! Kemungkinan token ke-pasang ke akun yang salah.")

    length = min(len(usn), len(wallets), len(akuns))
    accounts = []
    for i in range(length):
        at = akuns[i]["auth_token"]
        ct = akuns[i]["ct0"]
        print(f"  [{i+1}] {usn[i]} → auth:{at[:6]}...{at[-4:]} (len:{len(at)}) | ct0:{ct[:6]}...{ct[-4:]} (len:{len(ct)})")
        accounts.append({
            "username":   usn[i],
            "wallet":     wallets[i],
            "auth_token": at,
            "ct0":        ct,
        })
    return accounts

# ── HEADERS ───────────────────────────────────────────────────────────────────
def x_headers(auth_token: str, ct0: str) -> dict:
    return {
        "cookie":                    f"auth_token={auth_token}; ct0={ct0}",
        "x-csrf-token":              ct0,
        "authorization":             "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
        "user-agent":                "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
        "x-twitter-active-user":     "yes",
        "x-twitter-auth-type":       "OAuth2Session",
        "x-twitter-client-language": "en",
        "x-client-transaction-id":   secrets.token_urlsafe(64),
        "referer":                   f"https://x.com/{FOLLOW_TARGET}",
        "origin":                    "https://x.com",
        "sec-ch-ua":                 '"Not)A;Brand";v="24", "Chromium";v="116"',
        "sec-ch-ua-mobile":          "?1",
        "sec-ch-ua-platform":        '"Android"',
        "sec-fetch-dest":            "empty",
        "sec-fetch-mode":            "cors",
        "sec-fetch-site":            "same-origin",
    }

def kupo_headers() -> dict:
    return {
        "Content-Type":    "application/json",
        "Accept":          "*/*",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Origin":          "https://www.kupo.world",
        "Referer":         "https://www.kupo.world/",
        "User-Agent":      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
        "Sec-Fetch-Dest":  "empty",
        "Sec-Fetch-Mode":  "cors",
        "Sec-Fetch-Site":  "same-origin",
    }

# ── TWITTER ACTIONS ───────────────────────────────────────────────────────────
async def get_my_id(auth_token: str, ct0: str, username: str) -> str:
    """Ambil user ID via GraphQL UserByScreenName (verify_credentials di-block Twitter)."""
    from urllib.parse import urlencode
    h = x_headers(auth_token, ct0)
    variables = json.dumps({"screen_name": username, "withGrokTranslatedBio": True})
    features   = json.dumps({
        "hidden_profile_subscriptions_enabled": True,
        "profile_label_improvements_pcf_label_in_post_enabled": True,
        "responsive_web_profile_redirect_enabled": False,
        "rweb_tipjar_consumption_enabled": False,
        "verified_phone_label_enabled": False,
        "subscriptions_verification_info_is_identity_verified_enabled": True,
        "subscriptions_verification_info_verified_since_enabled": True,
        "highlights_tweets_tab_ui_enabled": True,
        "responsive_web_twitter_article_notes_tab_enabled": True,
        "subscriptions_feature_can_gift_premium": True,
        "creator_subscriptions_tweet_preview_api_enabled": True,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
        "responsive_web_graphql_timeline_navigation_enabled": True,
    })
    field_toggles = json.dumps({"withAuxiliaryUserLabels": True})
    params = urlencode({"variables": variables, "features": features, "fieldToggles": field_toggles})
    url    = f"https://x.com/i/api/graphql/2qvSHpkWTMS9i0zJAwDNiA/UserByScreenName?{params}"
    async with AsyncSession(impersonate="chrome116") as s:
        r = await s.get(url, headers=h)
    if r.status_code == 401:
        raise Exception("Token invalid/expired (401) — ganti cookie.")
    data = r.json()
    uid  = data.get("data", {}).get("user", {}).get("result", {}).get("rest_id")
    if not uid:
        raise Exception(f"Gagal ambil user ID: {json.dumps(data)[:200]}")
    return uid

async def get_target_user_id(auth_token: str, ct0: str, screen_name: str) -> str:
    """Lookup user ID dari screen_name target."""
    from urllib.parse import urlencode
    h = x_headers(auth_token, ct0)
    variables     = json.dumps({"screen_name": screen_name, "withGrokTranslatedBio": True})
    features      = json.dumps({
        "hidden_profile_subscriptions_enabled": True,
        "profile_label_improvements_pcf_label_in_post_enabled": True,
        "responsive_web_profile_redirect_enabled": False,
        "rweb_tipjar_consumption_enabled": False,
        "verified_phone_label_enabled": False,
        "subscriptions_verification_info_is_identity_verified_enabled": True,
        "subscriptions_verification_info_verified_since_enabled": True,
        "highlights_tweets_tab_ui_enabled": True,
        "responsive_web_twitter_article_notes_tab_enabled": True,
        "subscriptions_feature_can_gift_premium": True,
        "creator_subscriptions_tweet_preview_api_enabled": True,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
        "responsive_web_graphql_timeline_navigation_enabled": True,
    })
    field_toggles = json.dumps({"withAuxiliaryUserLabels": True})
    params        = urlencode({"variables": variables, "features": features, "fieldToggles": field_toggles})
    url           = f"https://x.com/i/api/graphql/2qvSHpkWTMS9i0zJAwDNiA/UserByScreenName?{params}"
    async with AsyncSession(impersonate="chrome116") as s:
        r = await s.get(url, headers=h)
    data = r.json()
    uid  = data.get("data", {}).get("user", {}).get("result", {}).get("rest_id")
    if not uid:
        raise Exception(f"Gagal lookup @{screen_name}: {json.dumps(data)[:200]}")
    return uid

async def x_follow(auth_token: str, ct0: str):
    h = {**x_headers(auth_token, ct0), "content-type": "application/x-www-form-urlencoded"}
    target_id = await get_target_user_id(auth_token, ct0, FOLLOW_TARGET)
    print(f"    ↳ [DEBUG] @{FOLLOW_TARGET} user_id={target_id}")
    async with AsyncSession(impersonate="chrome116") as s:
        r = await s.post(
            f"https://x.com/i/api/1.1/friendships/create.json?user_id={target_id}",
            headers=h,
        )
    print(f"    ↳ [DEBUG follow] status:{r.status_code} body:{r.text[:200]}")
    if r.status_code == 401:
        raise Exception("Follow 401 — token mati.")
    if r.status_code == 403:
        print("    ↳ Sudah follow (403), skip.")
        return
    data = r.json()
    if data.get("errors"):
        err = data["errors"][0]
        if err.get("code") == 160:
            print("    ↳ Sudah request follow (protected), skip.")
            return
        raise Exception(f"Follow error [{err.get('code')}]: {err.get('message')}")
    if data.get("following") is True:
        print("    ↳ Sudah follow, skip.")
        return
    if not data.get("id_str") and not data.get("id"):
        raise Exception(f"Follow gagal: {json.dumps(data)[:200]}")

async def x_retweet(auth_token: str, ct0: str, my_id: str):
    # REST v2 /retweets butuh OAuth 1.0a — pakai GraphQL CreateRetweet
    h       = {**x_headers(auth_token, ct0), "content-type": "application/json"}
    payload = {
        "variables": {"tweet_id": TWEET_ID},
        "queryId":   "mbRO74GrOvSfRcJnlMapnQ",
    }
    async with AsyncSession(impersonate="chrome116") as s:
        r = await s.post(
            "https://x.com/i/api/graphql/mbRO74GrOvSfRcJnlMapnQ/CreateRetweet",
            headers=h,
            data=json.dumps(payload),
        )
    data = r.json()
    print(f"    ↳ [DEBUG RT] status:{r.status_code} body:{json.dumps(data)[:300]}")
    for err in data.get("errors", []):
        if err.get("code") == 327:
            print("    ↳ Sudah RT, skip.")
            return
        raise Exception(f"RT error [{err.get('code')}]: {err.get('message')}")
    # retweet_results harus ada dan bukan null
    rt_result = data.get("data", {}).get("create_retweet", {}).get("retweet_results", {}).get("result")
    if rt_result:
        return
    raise Exception(f"RT gagal (create_retweet null/kosong): {json.dumps(data)[:300]}")

async def x_like(auth_token: str, ct0: str, my_id: str):
    # REST v2 /likes butuh OAuth 1.0a — pakai GraphQL FavoriteTweet
    h       = {**x_headers(auth_token, ct0), "content-type": "application/json"}
    payload = {
        "variables": {"tweet_id": TWEET_ID},
        "queryId":   "lI07N6Otwv1PhnEgXILM7A",
    }
    async with AsyncSession(impersonate="chrome116") as s:
        r = await s.post(
            "https://x.com/i/api/graphql/lI07N6Otwv1PhnEgXILM7A/FavoriteTweet",
            headers=h,
            data=json.dumps(payload),
        )
    data = r.json()
    for err in data.get("errors", []):
        if err.get("code") == 139:
            print("    ↳ Sudah like, skip.")
            return
    if data.get("data", {}).get("favorite_tweet"):
        return
    raise Exception(f"Like gagal: {json.dumps(data)[:200]}")

# ── KUPO ACTIONS ──────────────────────────────────────────────────────────────
async def kupo_submit_username(username: str):
    async with AsyncSession() as s:
        r = await s.post(
            f"{BASE_URL}/submit",
            headers=kupo_headers(),
            data=json.dumps({"stage": "xUser", "xUser": username}),
        )
    data = r.json()
    print(f"    ↳ [Kupo] submit username → {json.dumps(data)[:200]}")
    if not data.get("ok"):
        raise Exception(f"Submit username gagal: {json.dumps(data)[:200]}")

async def kupo_verify_task(username: str, task: str):
    async with AsyncSession() as s:
        r = await s.post(
            f"{BASE_URL}/verify-task",
            headers=kupo_headers(),
            data=json.dumps({"task": task, "xUser": username}),
        )
    data = r.json()
    print(f"    ↳ [Kupo] verify {task} → {json.dumps(data)[:200]}")
    if not data.get("ok"):
        raise Exception(f"Verify {task} gagal: {json.dumps(data)[:200]}")

async def kupo_submit_wallet(username: str, wallet: str):
    async with AsyncSession() as s:
        r = await s.post(
            f"{BASE_URL}/submit",
            headers=kupo_headers(),
            data=json.dumps({"stage": "wallet", "xUser": username, "wallet": wallet}),
        )
    data = r.json()
    print(f"    ↳ [Kupo] submit wallet → {json.dumps(data)[:200]}")
    if not data.get("ok"):
        raise Exception(f"Submit wallet gagal: {json.dumps(data)[:200]}")
    print(f"    ↳ ✅ Wallet terdaftar: {wallet}")

# ── PROCESS SATU AKUN ─────────────────────────────────────────────────────────
async def process_account(acc: dict, idx: int, total: int, state: dict):
    tag = f"[{idx}/{total}] [{acc['username']}]"
    key = acc["username"]
    try:
        print(f"\n{tag} ── Mulai")

        # Cek token
        if not is_done(state, key, "verify"):
            print(f"{tag} Cek token...")
            my_id = await get_my_id(acc["auth_token"], acc["ct0"], acc["username"])
            mark_done(state, key, "verify")
            # simpan my_id di state buat step selanjutnya
            state[key]["my_id"] = my_id
            save_state(state)
        else:
            my_id = state[key].get("my_id", "")
            if not my_id:
                print(f"{tag} my_id hilang dari state, re-fetch...")
                my_id = await get_my_id(acc["auth_token"], acc["ct0"], acc["username"])
                state[key]["my_id"] = my_id
                save_state(state)
            print(f"{tag} Token OK (cached), my_id={my_id}")

        # Submit username
        if is_done(state, key, "submit_username"):
            print(f"{tag} ⏭️  Submit username, skip")
        else:
            print(f"{tag} Submit username...")
            await kupo_submit_username(acc["username"])
            mark_done(state, key, "submit_username")

        # Follow
        if is_done(state, key, "follow"):
            print(f"{tag} ⏭️  Follow, skip")
        else:
            print(f"{tag} Follow @{FOLLOW_TARGET}...")
            await x_follow(acc["auth_token"], acc["ct0"])
            mark_done(state, key, "follow")

        # Verify follow
        if is_done(state, key, "verify_follow"):
            print(f"{tag} ⏭️  Verify follow, skip")
        else:
            print(f"{tag} Verify follow...")
            await kupo_verify_task(acc["username"], "follow")
            mark_done(state, key, "verify_follow")

        # Retweet
        if is_done(state, key, "rt"):
            print(f"{tag} ⏭️  RT, skip")
        else:
            print(f"{tag} Retweet...")
            await x_retweet(acc["auth_token"], acc["ct0"], my_id)
            mark_done(state, key, "rt")

        # Verify RT
        if is_done(state, key, "verify_rt"):
            print(f"{tag} ⏭️  Verify RT, skip")
        else:
            print(f"{tag} Verify RT...")
            await kupo_verify_task(acc["username"], "rt")
            mark_done(state, key, "verify_rt")

        # Like
        if is_done(state, key, "like"):
            print(f"{tag} ⏭️  Like, skip")
        else:
            print(f"{tag} Like...")
            await x_like(acc["auth_token"], acc["ct0"], my_id)
            mark_done(state, key, "like")

        # Verify like
        if is_done(state, key, "verify_like"):
            print(f"{tag} ⏭️  Verify like, skip")
        else:
            print(f"{tag} Verify like...")
            await kupo_verify_task(acc["username"], "like")
            mark_done(state, key, "verify_like")

        # Submit wallet
        if is_done(state, key, "wallet"):
            print(f"{tag} ⏭️  Submit wallet, skip")
        else:
            print(f"{tag} Submit wallet...")
            await kupo_submit_wallet(acc["username"], acc["wallet"])
            mark_done(state, key, "wallet")

        print(f"{tag} ✅ DONE!")

    except Exception as e:
        print(f"{tag} ❌ ERROR: {e}")

# ── MAIN ──────────────────────────────────────────────────────────────────────
async def main():
    accounts = load_accounts()
    total    = len(accounts)
    state    = load_state()

    print(f"\n📋 Total akun: {total}")
    print("\nPilih mode:")
    print("  1. Satu akun")
    print("  2. Semua akun")
    print("  3. From X to end")

    mode = input("\nPilihan (1/2/3): ").strip()
    selected = []

    if mode == "1":
        idx = input(f"Nomor akun (1-{total}): ").strip()
        i   = int(idx) - 1
        if i < 0 or i >= total:
            print("Nomor tidak valid.")
            return
        selected = [accounts[i]]

    elif mode == "2":
        selected = accounts

    elif mode == "3":
        frm = input(f"Mulai dari nomor (1-{total}): ").strip()
        i   = int(frm) - 1
        if i < 0 or i >= total:
            print("Nomor tidak valid.")
            return
        selected = accounts[i:]

    else:
        print("Pilihan tidak valid.")
        return

    print(f"\n🚀 Menjalankan {len(selected)} akun...\n")

    for i, acc in enumerate(selected):
        await process_account(acc, i + 1, len(selected), state)
        if i < len(selected) - 1:
            secs = random.randint(DELAY_MIN, DELAY_MAX)
            print(f"\n⏳ Delay {secs}s sebelum akun berikutnya...")
            await asyncio.sleep(secs)

    print("\n✅ Semua akun selesai!")

if __name__ == "__main__":
    asyncio.run(main())
