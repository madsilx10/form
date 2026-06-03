import os
import re
import json
import time
import hashlib
import requests

# ===================== CONFIG =====================
FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeXA-3dCH3qvfYg3_SmOfrFJS6a95LNIkor1lFGGGHDV52rKw/viewform"
ACCOUNTS_FILE = "accounts.txt"
ANSWERS_FILE = "answers.txt"
COOKIES_FILE = "cookies.txt"

ENTRY_DISCORD_ID       = "entry.1622627903"
ENTRY_DISCORD_USERNAME = "entry.2102376586"
ENTRY_ANSWERS = [
    "entry.847416569",
    "entry.553457099",
    "entry.636125148",
    "entry.1587002956",
    "entry.106675380",
    "entry.742665211",
    "entry.87707125",
]
# ==================================================


def load_accounts():
    accounts = []
    with open(ACCOUNTS_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) >= 3:
                accounts.append({
                    "discord_id": parts[0].strip(),
                    "discord_username": parts[1].strip(),
                    "cookie_name": parts[2].strip()
                })
    return accounts


def load_answers():
    answers = []
    with open(ANSWERS_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                answers.append(line)
    return answers


def load_cookies(cookie_name):
    with open(COOKIES_FILE, "r") as f:
        content = f.read()

    name_match = re.search(rf"-?{re.escape(cookie_name)}-?", content)
    if not name_match:
        print(f"  [!] Cookies '{cookie_name}' tidak ditemukan di {COOKIES_FILE}")
        return None

    rest = content[name_match.end():].strip()
    decoder = json.JSONDecoder()
    try:
        cookies_list, _ = decoder.raw_decode(rest)
        return {c["name"]: c["value"] for c in cookies_list}
    except Exception as e:
        print(f"  [!] Gagal parse cookies: {e}")
        return None


def generate_sapisidhash(sapisid, origin):
    ts = str(int(time.time()))
    digest = hashlib.sha1(f"{ts} {sapisid} {origin}".encode()).hexdigest()
    return f"SAPISIDHASH {ts}_{digest}"


def submit_form(account, answers):
    print(f"\n  [→] {account['discord_id']} ({account['cookie_name']})")

    cookies = load_cookies(account["cookie_name"])
    if not cookies:
        return

    session = requests.Session()
    session.cookies.update(cookies)

    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "Referer": FORM_URL,
        "Origin": "https://docs.google.com",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
    }

    sapisid = cookies.get("SAPISID") or cookies.get("__Secure-3PAPISID", "")
    if sapisid:
        headers["Authorization"] = generate_sapisidhash(sapisid, "https://docs.google.com")

    # GET form buat ambil fbzx
    r = session.get(FORM_URL + "?pli=1", headers=headers, timeout=30)
    fbzx = re.search(r'fbzx" value="(-?\d+)"', r.text)
    fbzx_val = fbzx.group(1) if fbzx else ""

    data = {
        "draftResponse": f'[null,null,"{fbzx_val}"]',
        "pageHistory": "0",
        "fbzx": fbzx_val,
        ENTRY_DISCORD_ID: account["discord_id"],
        ENTRY_DISCORD_USERNAME: account["discord_username"],
    }

    for i, entry_id in enumerate(ENTRY_ANSWERS):
        if i < len(answers):
            data[entry_id] = answers[i]

    try:
        action_url = FORM_URL.replace("/viewform", "/formResponse") + "?pli=1"
        response = session.post(action_url, data=data, headers=headers, timeout=30)

        if response.status_code == 200 and ("formResponse" in response.url or "recorded" in response.text.lower() or "dicatat" in response.text.lower()):
            print(f"  [✓] SUKSES")
        elif response.status_code == 200:
            print(f"  [?] Status 200, cek manual")
        else:
            print(f"  [✗] GAGAL - Status: {response.status_code}")

    except Exception as e:
        print(f"  [✗] ERROR: {e}")


def list_accounts(accounts):
    print("\n  Daftar akun:")
    for i, acc in enumerate(accounts):
        print(f"  {i+1}. {acc['discord_id']} ({acc['cookie_name']})")


def print_menu(total):
    print("\n┌─────────────────────────────────────┐")
    print("│       GOOGLE FORM AUTO SUBMIT        │")
    print("├─────────────────────────────────────┤")
    print(f"│  Total akun: {total:<24}│")
    print("├─────────────────────────────────────┤")
    print("│  1  → Run 1 akun                     │")
    print("│  2  → Run semua akun                 │")
    print("│  3  → Run dari akun X sampai akhir   │")
    print("│  q  → Keluar                         │")
    print("└─────────────────────────────────────┘")


def main():
    accounts = load_accounts()
    answers = load_answers()

    if not accounts:
        print("[!] accounts.txt kosong.")
        return

    print_menu(len(accounts))
    choice = input("\nPilihan: ").strip().lower()

    if choice == "q":
        return

    elif choice == "1":
        list_accounts(accounts)
        idx = input("\n  Pilih nomor akun: ").strip()
        if idx.isdigit() and 1 <= int(idx) <= len(accounts):
            submit_form(accounts[int(idx)-1], answers)
        else:
            print("[!] Nomor tidak valid.")

    elif choice == "2":
        print(f"\n[→] Menjalankan semua {len(accounts)} akun...\n")
        for acc in accounts:
            submit_form(acc, answers)
            time.sleep(1)
        print("\n[✓] Selesai semua.")

    elif choice == "3":
        list_accounts(accounts)
        start = input("\n  Mulai dari akun nomor: ").strip()
        if start.isdigit() and 1 <= int(start) <= len(accounts):
            targets = accounts[int(start)-1:]
            print(f"\n[→] Menjalankan akun {start} sampai {len(accounts)}...\n")
            for acc in targets:
                submit_form(acc, answers)
                time.sleep(1)
            print("\n[✓] Selesai.")
        else:
            print("[!] Nomor tidak valid.")

    else:
        print("[!] Pilihan tidak dikenali.")


if __name__ == "__main__":
    main()
