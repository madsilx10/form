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
SESSIONS_DIR = "sessions"

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
            if len(parts) >= 4:
                accounts.append({
                    "discord_id": parts[0].strip(),
                    "discord_username": parts[1].strip(),
                    "email": parts[2].strip(),
                    "password": parts[3].strip(),
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


def session_path(email):
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    safe = email.replace("@", "_").replace(".", "_")
    return os.path.join(SESSIONS_DIR, f"{safe}.txt")


def save_session(email, cookies_dict):
    path = session_path(email)
    with open(path, "w") as f:
        json.dump(cookies_dict, f)


def load_session(email):
    path = session_path(email)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def google_login(email, password):
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    })

    # Step 1: GET login page
    r = session.get("https://accounts.google.com/ServiceLogin?service=wise&continue=https://docs.google.com/")
    
    # Ambil GALX token
    galx = re.search(r'name="GALX"[^>]*value="([^"]+)"', r.text)
    gxf = re.search(r'name="gxf"[^>]*value="([^"]+)"', r.text)
    
    # Step 2: POST email
    data = {
        "Email": email,
        "next": "https://docs.google.com/",
        "action": "By signing in",
    }
    if galx:
        data["GALX"] = galx.group(1)
    if gxf:
        data["gxf"] = gxf.group(1)

    r2 = session.post("https://accounts.google.com/signin/v1/lookup", data=data, allow_redirects=True)
    
    # Step 3: POST password  
    passwd_data = {
        "Email": email,
        "Passwd": password,
        "signIn": "Sign in",
        "PersistentCookie": "yes",
    }
    if gxf:
        passwd_data["gxf"] = gxf.group(1)

    r3 = session.post("https://accounts.google.com/signin/challenge/sl/password", data=passwd_data, allow_redirects=True)

    cookies = dict(session.cookies)
    
    if "SID" in cookies or "__Secure-1PSID" in cookies:
        print(f"  [✓] Login berhasil: {email}")
        save_session(email, cookies)
        return session, cookies
    else:
        print(f"  [!] Login gagal: {email} - cek email/password")
        print(f"  [!] Cookies: {list(cookies.keys())}")
        return None, None


def get_session(account):
    email = account["email"]
    
    # Cek session tersimpan
    saved = load_session(email)
    if saved and ("SID" in saved or "__Secure-1PSID" in saved):
        print(f"  [✓] Pakai session tersimpan: {email}")
        session = requests.Session()
        session.cookies.update(saved)
        return session, saved
    
    # Login baru
    print(f"  [→] Login: {email}")
    return google_login(email, account["password"])


def generate_sapisidhash(sapisid, origin):
    ts = str(int(time.time()))
    digest = hashlib.sha1(f"{ts} {sapisid} {origin}".encode()).hexdigest()
    return f"SAPISIDHASH {ts}_{digest}"


def submit_form(account, answers):
    print(f"\n  [→] {account['discord_id']} ({account['email']})")

    session, cookies = get_session(account)
    if not session:
        return

    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "Referer": FORM_URL,
        "Origin": "https://docs.google.com",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    # Generate SAPISIDHASH
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
            # Hapus session tersimpan biar login ulang next run
            path = session_path(account["email"])
            if os.path.exists(path):
                os.remove(path)

    except Exception as e:
        print(f"  [✗] ERROR: {e}")


def list_accounts(accounts):
    print("\n  Daftar akun:")
    for i, acc in enumerate(accounts):
        print(f"  {i+1}. {acc['discord_id']} ({acc['email']})")


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
    os.makedirs(SESSIONS_DIR, exist_ok=True)
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
