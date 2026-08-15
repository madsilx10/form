import requests
import time
import json
from pathlib import Path

URL = "https://script.google.com/macros/s/AKfycbwEZI_VRNKCUmPEhoLTNRnbu9b-eyVYbJaNKFmox__R8tMP-ldb61JpggdtqkZna-UBxw/exec"

HEADERS = {
    "Content-Type": "text/plain;charset=utf-8"
}

DELAY = 1.5  # detik antar request

def load_lines(filename):
    path = Path(filename)
    if not path.exists():
        print(f"[ERROR] File tidak ditemukan: {filename}")
        return []
    lines = [l.strip() for l in path.read_text().splitlines() if l.strip()]
    return lines

def submit(eth, handle):
    payload = json.dumps({
        "formType": "whitelist",
        "eth": eth,
        "handle": handle,
        "note": ""
    })
    try:
        r = requests.post(URL, data=payload, headers=HEADERS, timeout=15)
        data = r.json()
        ok = data.get("ok", False)
        count = data.get("count", "?")
        return ok, count
    except Exception as e:
        return False, str(e)

def main():
    usernames = load_lines("usn1.txt")
    wallets   = load_lines("wallet.txt")

    if not usernames or not wallets:
        print("File kosong atau tidak ada.")
        return

    # Pair 1:1 — stop di list yang lebih pendek
    pairs = list(zip(wallets, usernames))
    total = len(pairs)
    print(f"Total pasangan: {total}\n")

    for i, (eth, handle) in enumerate(pairs, 1):
        ok, count = submit(eth, handle)
        status = "✓" if ok else "✗"
        print(f"[{i}/{total}] {status}  {handle} | {eth[:10]}... | count={count}")
        if i < total:
            time.sleep(DELAY)

    print("\nSelesai.")

if __name__ == "__main__":
    main()
