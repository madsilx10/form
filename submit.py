import os
import time
import shutil
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

# ===================== CONFIG =====================
FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeXA-3dCH3qvfYg3_SmOfrFJS6a95LNIkor1lFGGGHDV52rKw/viewform"
SESSIONS_DIR = "sessions"
ACCOUNTS_FILE = "accounts.txt"
ANSWERS_FILE = "answers.txt"
CHROMEDRIVER_PATH = "/usr/lib/chromium-browser/chromedriver"

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
            if len(parts) >= 2:
                accounts.append({
                    "discord_id": parts[0].strip(),
                    "discord_username": parts[1].strip(),
                    "session_name": parts[2].strip() if len(parts) > 2 else parts[0].strip()
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


def get_driver(session_name):
    session_path = os.path.abspath(os.path.join(SESSIONS_DIR, session_name))
    os.makedirs(session_path, exist_ok=True)
    opts = Options()
    opts.add_argument(f"--user-data-dir={session_path}")
    opts.add_argument("--profile-directory=Default")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--remote-debugging-port=9222")
    opts.add_argument("--disable-software-rasterizer")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--no-first-run")
    opts.add_argument("--disable-background-networking")
    service = Service(CHROMEDRIVER_PATH)
    return webdriver.Chrome(service=service, options=opts)


def submit_form(account, answers):
    session_name = account["session_name"]
    print(f"\n  [→] {account['discord_id']} ({session_name})")
    driver = get_driver(session_name)
    try:
        driver.get(FORM_URL)
        time.sleep(3)

        if "accounts.google.com" in driver.current_url:
            print("  [!] Belum login — silakan login manual di browser...")
            input("  [!] Tekan ENTER setelah selesai login... ")
            driver.get(FORM_URL)
            time.sleep(3)

        print("  [✓] Form terbuka, mengisi...")

        try:
            checkbox = driver.find_element(By.XPATH, "//div[@role='checkbox']")
            if checkbox.get_attribute("aria-checked") == "false":
                checkbox.click()
                time.sleep(0.5)
        except:
            pass

        fill_text_field(driver, ENTRY_DISCORD_ID, account["discord_id"])
        time.sleep(0.3)
        fill_text_field(driver, ENTRY_DISCORD_USERNAME, account["discord_username"])
        time.sleep(0.3)

        for i, entry_id in enumerate(ENTRY_ANSWERS):
            if i < len(answers):
                select_radio(driver, entry_id, answers[i])
                time.sleep(0.3)

        submit_btn = driver.find_element(By.XPATH, "//div[@role='button'][.//span[contains(text(),'Submit') or contains(text(),'Kirim')]]")
        submit_btn.click()
        time.sleep(3)

        if "formResponse" in driver.current_url or "recorded" in driver.page_source or "dicatat" in driver.page_source:
            print(f"  [✓] SUKSES")
        else:
            print(f"  [?] Tidak yakin berhasil, cek manual")

    except Exception as e:
        print(f"  [✗] ERROR: {e}")
    finally:
        driver.quit()


def fill_text_field(driver, entry_id, value):
    try:
        field = driver.find_element(By.XPATH, f"//input[@name='{entry_id}'] | //textarea[@name='{entry_id}']")
        field.clear()
        field.send_keys(value)
    except Exception as e:
        print(f"  [!] Gagal isi {entry_id}: {e}")


def select_radio(driver, entry_id, answer_text):
    try:
        options = driver.find_elements(By.XPATH, f"//div[@data-value='{answer_text}'] | //label[contains(.,'{answer_text}')]")
        if options:
            options[0].click()
        else:
            radios = driver.find_elements(By.XPATH, f"//input[@name='{entry_id}']")
            for r in radios:
                if r.get_attribute("value") == answer_text:
                    driver.execute_script("arguments[0].click();", r)
                    break
    except Exception as e:
        print(f"  [!] Gagal pilih {entry_id}: {e}")


def copy_session(session_name, dest_dir):
    src = os.path.abspath(os.path.join(SESSIONS_DIR, session_name))
    dst = os.path.abspath(os.path.join(dest_dir, session_name))
    if not os.path.exists(src):
        print(f"  [!] Session '{session_name}' tidak ditemukan.")
        return
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    print(f"  [✓] Session '{session_name}' → {dst}")


def list_accounts(accounts):
    print("\n  Daftar akun:")
    for i, acc in enumerate(accounts):
        print(f"  {i+1}. {acc['discord_id']} ({acc['session_name']})")


def print_menu(total):
    print("\n┌─────────────────────────────────────┐")
    print("│       GOOGLE FORM AUTO SUBMIT        │")
    print("├─────────────────────────────────────┤")
    print(f"│  Total akun: {total:<24}│")
    print("├─────────────────────────────────────┤")
    print("│  1  → Run 1 akun                     │")
    print("│  2  → Run semua akun                 │")
    print("│  3  → Run dari akun X sampai akhir   │")
    print("│  4  → Copy session                   │")
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
        print("\n[✓] Selesai semua.")

    elif choice == "3":
        list_accounts(accounts)
        start = input("\n  Mulai dari akun nomor: ").strip()
        if start.isdigit() and 1 <= int(start) <= len(accounts):
            targets = accounts[int(start)-1:]
            print(f"\n[→] Menjalankan akun {start} sampai {len(accounts)}...\n")
            for acc in targets:
                submit_form(acc, answers)
            print("\n[✓] Selesai.")
        else:
            print("[!] Nomor tidak valid.")

    elif choice == "4":
        list_accounts(accounts)
        name = input("\n  Nama session: ").strip()
        dest = input("  Folder tujuan: ").strip()
        copy_session(name, dest)

    else:
        print("[!] Pilihan tidak dikenali.")


if __name__ == "__main__":
    main()
