import json
import re
import os

COOKIES_FILE = "cookies.txt"

def load_all_cookies():
    if not os.path.exists(COOKIES_FILE):
        return {}
    
    with open(COOKIES_FILE, "r") as f:
        content = f.read()
    
    result = {}
    # Cari semua blok akun
    blocks = re.split(r'\n(?=\S)', content.strip())
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        lines = block.split('\n', 1)
        if len(lines) < 2:
            continue
        name = lines[0].strip()
        try:
            cookies = json.loads(lines[1].strip())
            result[name] = cookies
        except:
            pass
    return result


def save_all_cookies(all_cookies):
    with open(COOKIES_FILE, "w") as f:
        for name, cookies in all_cookies.items():
            f.write(f"{name}\n")
            f.write(json.dumps(cookies, indent=4))
            f.write("\n\n")
    print(f"[✓] {COOKIES_FILE} disimpan.")


def add_or_update_cookie(cookies_list, name, value, domain=".google.com"):
    # Cek apakah sudah ada
    for c in cookies_list:
        if c["name"] == name:
            c["value"] = value
            return cookies_list
    # Tambah baru
    cookies_list.append({
        "name": name,
        "value": value,
        "domain": domain,
        "path": "/",
        "secure": True,
        "httpOnly": True,
        "session": False
    })
    return cookies_list


def main():
    all_cookies = load_all_cookies()
    
    print("\n┌─────────────────────────────────────┐")
    print("│         COOKIES MANAGER              │")
    print("└─────────────────────────────────────┘")
    
    if all_cookies:
        print("\n  Akun tersedia:")
        for i, name in enumerate(all_cookies.keys()):
            print(f"  {i+1}. {name}")
    else:
        print("\n  Belum ada akun di cookies.txt")

    print("\n  Ketik nama akun (contoh: akun1)")
    print("  atau 'baru' untuk tambah akun baru")
    akun = input("\n  Akun: ").strip()

    if akun == "baru":
        akun = input("  Nama akun baru: ").strip()
        if akun in all_cookies:
            print(f"  [!] Akun '{akun}' sudah ada, akan diupdate.")
        else:
            all_cookies[akun] = []

    elif akun not in all_cookies:
        print(f"  [!] Akun '{akun}' tidak ditemukan, membuat baru...")
        all_cookies[akun] = []

    cookies_list = all_cookies[akun]

    print(f"\n  Update cookies untuk akun: {akun}")
    print("  Kosongkan untuk skip\n")

    sid = input("  SID: ").strip()
    hsid = input("  HSID: ").strip()
    ssid = input("  SSID (opsional): ").strip()

    if sid:
        cookies_list = add_or_update_cookie(cookies_list, "SID", sid)
        print("  [✓] SID ditambahkan")
    if hsid:
        cookies_list = add_or_update_cookie(cookies_list, "HSID", hsid)
        print("  [✓] HSID ditambahkan")
    if ssid:
        cookies_list = add_or_update_cookie(cookies_list, "SSID", ssid)
        print("  [✓] SSID ditambahkan")

    all_cookies[akun] = cookies_list
    save_all_cookies(all_cookies)
    print(f"\n  Total cookies akun '{akun}': {len(cookies_list)}")


if __name__ == "__main__":
    main()
