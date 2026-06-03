import os
import sys
import time
import shutil
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ===================== CONFIG =====================
FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeXA-3dCH3qvfYg3_SmOfrFJS6a95LNIkor1lFGGGHDV52rKw/viewform"
SESSIONS_DIR = "sessions"
ACCOUNTS_FILE = "accounts.txt"
ANSWERS_FILE = "answers.txt"

# Entry IDs
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

    driver = webdriver.Chrome(options=opts)
    return driver


def submit_form(account, answers):
    session_name = account["session_name"]
    print(f"\n[→] Akun: {account['discord_id']} | Session: {session_name}")

    driver = get_driver(session_name)
    wait = WebDriverWait(driver, 60)

    try:
        driver.get(FORM_URL)
        time.sleep(3)

        # Cek apakah perlu login
        if "accounts.google.com" in driver.current_url:
            print("[!] Belum login. Silakan login manual di browser yang terbuka...")
            print("[!] Tekan ENTER setelah selesai login...")
            input()
            driver.get(FORM_URL)
            time.sleep(3)

        print("[✓] Form terbuka, mulai isi...")

        # Centang record email jika ada
        try:
            checkbox = driver.find_element(By.XPATH, "//div[@role='checkbox']")
            if checkbox.get_attribute("aria-checked") == "false":
                checkbox.click()
                time.sleep(0.5)
        except:
            pass

        # Isi Discord ID
        fill_text_field(driver, ENTRY_DISCORD_ID, account["discord_id"])
        time.sleep(0.3)

        # Isi Discord Username
        fill_text_field(driver, ENTRY_DISCORD_USERNAME, account["discord_username"])
        time.sleep(0.3)

        # Pilih jawaban multiple choice
        for i, entry_id in enumerate(ENTRY_ANSWERS):
            if i < len(answers):
                select_radio(driver, entry_id, answers[i])
                time.sleep(0.3)

        # Submit
        submit_btn = driver.find_element(By.XPATH, "//div[@role='button'][.//span[contains(text(),'Submit') or contains(text(),'Kirim')]]")
        submit_btn.click()
        time.sleep(3)

        if "formResponse" in driver.current_url or "Your response has been recorded" in driver.page_source or "Respons Anda telah dicatat" in driver.page_source:
            print(f"[✓] SUKSES submit: {account['discord_id']}")
        else:
            print(f"[?] Submit mungkin berhasil, cek manual.")

    except Exception as e:
        print(f"[✗] ERROR: {e}")
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
        # Cari radio button berdasarkan value atau label teks
        options = driver.find_elements(By.XPATH, f"//div[@data-value='{answer_text}'] | //label[contains(.,'{answer_text}')]")
        if options:
            options[0].click()
        else:
            # Fallback: cari semua radio di grup entry ini
            radios = driver.find_elements(By.XPATH, f"//input[@name='{entry_id}']")
            for r in radios:
                if r.get_attribute("value") == answer_text:
                    driver.execute_script("arguments[0].click();", r)
                    break
    except Exception as e:
        print(f"  [!] Gagal pilih {entry_id} = {answer_text}: {e}")


def copy_session(session_name, dest_dir):
    src = os.path.abspath(os.path.join(SESSIONS_DIR, session_name))
    dst = os.path.abspath(os.path.join(dest_dir, session_name))
    if not os.path.exists(src):
        print(f"[!] Session '{session_name}' tidak ditemukan.")
        return
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    print(f"[✓] Session '{session_name}' berhasil dicopy ke: {dst}")


def print_menu(accounts):
    print("\n" + "="*50)
    print("  GOOGLE FORM AUTO SUBMIT")
    print("="*50)
    print(f"  Total akun: {len(accounts)}")
    print("-"*50)
    for i, acc in enumerate(accounts):
        print(f"  [{i+1}] {acc['discord_id']} ({acc['session_name']})")
    print("-"*50)
    print("  Opsi run:")
    print("  • Ketik nomor (misal: 2) → run 1 akun")
    print("  • Ketik 'all'            → run semua akun")
    print("  • Ketik '3-end'          → run akun ke-3 sampai akhir")
    print("  • Ketik 'copy <nama> <dest>' → copy session")
    print("  • Ketik 'q'              → keluar")
    print("="*50)


def main():
    os.makedirs(SESSIONS_DIR, exist_ok=True)

    accounts = load_accounts()
    answers = load_answers()

    if not accounts:
        print("[!] accounts.txt kosong atau tidak ditemukan.")
        return

    print(f"[✓] {len(accounts)} akun dimuat, {len(answers)} jawaban dimuat.")

    print_menu(accounts)
    choice = input("\nPilihan: ").strip().lower()

    if choice == "q":
        return

    elif choice.startswith("copy "):
        parts = choice.split()
        if len(parts) == 3:
            copy_session(parts[1], parts[2])
        else:
            print("[!] Format: copy <session_name> <dest_folder>")

    elif choice == "all":
        for acc in accounts:
            submit_form(acc, answers)

    elif "-end" in choice:
        try:
            start = int(choice.replace("-end", "")) - 1
            for acc in accounts[start:]:
                submit_form(acc, answers)
        except:
            print("[!] Format salah. Contoh: 3-end")

    elif choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(accounts):
            submit_form(accounts[idx], answers)
        else:
            print("[!] Nomor akun tidak valid.")

    else:
        print("[!] Pilihan tidak dikenali.")


if __name__ == "__main__":
    main()
