import requests
import time
import random
import string
from pathlib import Path

URL = "https://docs.google.com/forms/d/e/1FAlpQLSe_fBrSeoiU1ymrg0ktXjK-FLC1i05CZBrFB0V2Sm-AHGsnFQ/formResponse"

HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    "Origin": "https://omrevo.com",
    "Referer": "https://omrevo.com/",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
}

DELAY = 1.5  # detik antar request

def load_lines(filename):
    path = Path(filename)
    if not path.exists():
        print(f"[ERROR] File tidak ditemukan: {filename}")
        return []
    return [l.strip() for l in path.read_text().splitlines() if l.strip()]

def gen_tweet_id():
    # Format: "20" + 17 digit random = 19 digit total
    suffix = ''.join(random.choices(string.digits, k=17))
    return f"20{suffix}"

def submit(handle, eth):
    handle_clean = handle.lstrip('@')
    tweet_id     = gen_tweet_id()
    tweet_url    = f"https://x.com/{handle_clean}/status/{tweet_id}?s=20"
    at_handle    = f"@{handle_clean}"

    data = {
        "entry.989639949": at_handle,
        "entry.1337018009": "Yes",
        "entry.740995001":  tweet_url,
        "entry.2132567686": "Yes",
        "entry.1088931015": tweet_url,
        "entry.326090022":  eth,
    }

    try:
        r = requests.post(URL, data=data, headers=HEADERS, timeout=15)
        ok = r.status_code == 200
        return ok, tweet_url
    except Exception as e:
        return False, str(e)

def main():
    usernames = load_lines("usn1.txt")
    wallets   = load_lines("wallet.txt")

    if not usernames or not wallets:
        print("File kosong atau tidak ada.")
        return

    pairs = list(zip(usernames, wallets))
    total = len(pairs)
    print(f"Total pasangan: {total}\n")

    for i, (handle, eth) in enumerate(pairs, 1):
        ok, tweet_url = submit(handle, eth)
        status = "✓" if ok else "✗"
        print(f"[{i}/{total}] {status}  @{handle.lstrip('@')} | {eth[:10]}... | {tweet_url}")
        if i < total:
            time.sleep(DELAY)

    print("\nSelesai.")

if __name__ == "__main__":
    main()
