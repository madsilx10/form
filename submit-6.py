import os
import re
import json
import time
import requests

# ===================== CONFIG =====================
FORM_URL = "GANTI_LINK_FORM_DISINI"
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

    # Cari blok cookies berdasarkan nama akun
    pattern = rf"{re.escape(cookie_name)}\n(\[.*?\])"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        print(f"  [!] Cookies '{cookie_name}' tidak ditemukan di {COOKIES_FILE}")
        return None

    cookies_list = json.loads(match.group(1))
    cookies_dict = {c["name"]: c["value"] for c in cookies_list}
    return cookies_dict


def get_form_action_url():
    # Convert viewform URL ke formResponse URL
    return FORM_URL.replace("/viewform", "/formResponse")


def submit_form(account, answers):
    print(f"\n  [→] {account['discord_id']} ({account['cookie_name']})")

    cookies = load_cookies(account["cookie_name"])
    if not cookies:
        return

    session = requests.Session()
    session.cookies.update(cookies)

    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
        "Referer": FORM_URL,
        "Origin": "https://docs.google.com",
    }

    data = {
        "draftResponse": "[]",
        "pageHistory": "0",
        ENTRY_DISCORD_ID: account["discord_id"],
        ENTRY_DISCORD_USERNAME: account["discord_username"],
    }

    for i, entry_id in enumerate(ENTRY_ANSWERS):
        if i < len(answers):
            data[entry_id] = answers[i]

    try:
        action_url = get_form_action_url()
        response = session.post(action_url, data=data, headers=headers, timeout=30)

        if response.status_code == 200 and ("formResponse" in response.url or "recorded" in response.text.lower()):
            print(f"  [✓] SUKSES")
        elif response.status_code == 200:
            print(f"  [?] Status 200 tapi tidak yakin berhasil, cek manual")
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
