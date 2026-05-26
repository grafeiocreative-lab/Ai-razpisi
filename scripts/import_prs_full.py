#!/usr/bin/env python3
"""
Uvoz celotnega OPSI PRS registra v Supabase prs_cache.

Prebere ZIP direktno z OPSI portala (ali iz /tmp če že naložen),
parsira CSV (UTF-16LE), in naredi batch upsert v prs_cache.

Uporaba:
  python3 scripts/import_prs_full.py                              # vse naenkrat
  python3 scripts/import_prs_full.py --limit 50000               # prvih 50k
  python3 scripts/import_prs_full.py --offset 50000 --limit 50000 # drugi del (50k–100k)
  python3 scripts/import_prs_full.py --offset 100000             # nadaljuj od 100k do konca
  python3 scripts/import_prs_full.py --dry-run                   # samo pokaži prvih 5 vrstic
"""

import csv
import io
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
import zipfile

# macOS Python ne ima privzetih CA certifikatov — bypass za lokalni skript
SSL_CTX = ssl._create_unverified_context()

# ── Konfiguracija ──────────────────────────────────────
SUPABASE_URL = "https://fhoayfzwfsalnnpxxlak.supabase.co"
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SERVICE_ROLE_KEY:
    raise SystemExit("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.")
ZIP_URL = "https://podatki.gov.si/dataset/9ee1a9aa-c224-4995-b2ad-3760d7af0748/resource/3ac0b7fc-eaf3-4bd6-81c0-5ade530dc9a6/download/"
LOCAL_ZIP = "/tmp/prs_bundle.zip"
CSV_NAME = "opsiprs-beb70929-3d0d-41c6-9af2-25d525d906d3.csv"

BATCH_SIZE = 500
TABLE = "prs_cache"
SOURCE = "opsi-prs"

# ── Regije po poštnih številkah ────────────────────────
EAST_PC = re.compile(r"^[23689]")
WEST_PC = re.compile(r"^[145]")
EAST_HINTS = ["maribor","celje","ptuj","murska sobota","novo mesto","krško",
              "brežice","velenje","slovenj gradec","trbovlje","zagorje","ormož",
              "lendava","radenci","slovenska bistrica","rogaška","sevnica"]
WEST_HINTS = ["ljubljana","kranj","koper","nova gorica","postojna","idrija",
              "izola","piran","ajdovščina","logatec","vrhnika","domžale",
              "kamnik","škofja loka","jesenice","tolmin"]

def infer_region(post_code: str, location: str) -> str | None:
    pc = (post_code or "").strip()
    loc = (location or "").lower()
    if EAST_PC.match(pc): return "Vzhodna Slovenija"
    if WEST_PC.match(pc): return "Zahodna Slovenija"
    if any(h in loc for h in EAST_HINTS): return "Vzhodna Slovenija"
    if any(h in loc for h in WEST_HINTS): return "Zahodna Slovenija"
    return None

def clean_address(val: str) -> str:
    return re.sub(r"\s+", " ", val.replace('"', " ")).replace(" ,", ",").strip()

def map_row(row: dict) -> dict | None:
    reg = (row.get("Matična številka") or "").strip()
    name = (row.get("Popolno ime") or "").strip()
    if not reg or not name:
        return None

    street = (row.get("Ulica") or "").strip()
    house_no = (row.get("Hišna št ") or row.get("Hišna št") or "").strip()
    house_add = (row.get("Hišna št  dodatek") or row.get("Hišna št dodatek") or "").replace('"', "").strip()
    post_code = (row.get("Poštna št ") or row.get("Poštna št") or "").strip()
    post = (row.get("Pošta") or "").strip()

    addr_parts = " ".join(filter(None, [street, house_no, house_add])).strip()
    pc_parts = " ".join(filter(None, [post_code, post])).strip()
    address = clean_address(", ".join(filter(None, [addr_parts, pc_parts])))

    return {
        "registration_number": reg,
        "company_name": name,
        "tax_number": None,
        "legal_form": row.get("Pravnoorganizacijska oblika") or None,
        "address": address or None,
        "municipality": post or None,
        "region": infer_region(post_code, post or address),
        "main_activity_code": None,
        "main_activity_name": None,
        "source": SOURCE,
        "raw_payload": dict(row),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

def upsert_batch(batch: list[dict]) -> tuple[int, str | None]:
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?on_conflict=registration_number"
    data = json.dumps(batch).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
            return resp.status, None
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]
        return e.code, body
    except Exception as ex:
        return 0, str(ex)

def download_zip():
    if os.path.exists(LOCAL_ZIP) and os.path.getsize(LOCAL_ZIP) > 1_000_000:
        print(f"ZIP že obstaja: {LOCAL_ZIP} ({os.path.getsize(LOCAL_ZIP)//1024//1024} MB)")
        return
    print(f"Prenašam ZIP z OPSI... ({ZIP_URL})")
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp, open(LOCAL_ZIP, "wb") as f:
        total = 0
        while True:
            chunk = resp.read(65536)
            if not chunk:
                break
            f.write(chunk)
            total += len(chunk)
            print(f"\r  {total//1024//1024} MB", end="", flush=True)
    print(f"\nPrenos končan: {os.path.getsize(LOCAL_ZIP)//1024//1024} MB")

def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    offset = 0
    limit = None
    if "--offset" in args:
        idx = args.index("--offset")
        offset = int(args[idx + 1])
    if "--limit" in args:
        idx = args.index("--limit")
        limit = int(args[idx + 1])

    if not dry_run:
        download_zip()

    print(f"\nOdpiram ZIP in CSV...")
    with zipfile.ZipFile(LOCAL_ZIP, "r") as zf:
        with zf.open(CSV_NAME) as raw:
            # Preberi vse v spomin (120MB) — potrebno za UTF-16LE dekodiranje
            content = raw.read().decode("utf-16-le")
            # Odstrani BOM če prisoten
            if content.startswith("﻿"):
                content = content[1:]

    print(f"CSV naložen, parsiranje...")
    reader = csv.DictReader(io.StringIO(content))

    seen = 0
    imported = 0
    skipped = 0
    errors = 0
    batch: list[dict] = []
    t0 = time.time()

    for row in reader:
        seen += 1
        if seen <= offset:
            if seen % 50000 == 0:
                print(f"  Preskakovanie... {seen}")
            continue

        if limit is not None and (seen - offset) > limit:
            print(f"\n  Dosežena meja {limit} zapisov — končujem.")
            break

        record = map_row(row)
        if record is None:
            skipped += 1
            continue

        if dry_run:
            print(json.dumps(record, ensure_ascii=False, indent=2))
            if seen >= offset + 5:
                print(f"\nDry run končan po {seen - offset} vrsticah.")
                return
            continue

        batch.append(record)

        if len(batch) >= BATCH_SIZE:
            status, err = upsert_batch(batch)
            if err:
                print(f"\n[NAPAKA] batch pri seen={seen}: HTTP {status} — {err}")
                errors += len(batch)
            else:
                imported += len(batch)
            batch = []

            elapsed = time.time() - t0
            rate = imported / elapsed if elapsed > 0 else 0
            print(f"\r  {seen:>7} vrstic | {imported:>7} uvoženih | {rate:.0f}/s | {elapsed:.0f}s", end="", flush=True)

    # Zadnji batch
    if batch and not dry_run:
        status, err = upsert_batch(batch)
        if err:
            print(f"\n[NAPAKA] zadnji batch: HTTP {status} — {err}")
            errors += len(batch)
        else:
            imported += len(batch)

    elapsed = time.time() - t0
    print(f"\n\n{'='*50}")
    print(f"Skupaj vrstic:   {seen}")
    print(f"Uvoženih:        {imported}")
    print(f"Preskočenih:     {skipped}")
    print(f"Napak:           {errors}")
    print(f"Čas:             {elapsed:.1f}s")
    print(f"Hitrost:         {imported/elapsed:.0f} zapisov/s" if elapsed > 0 else "")

if __name__ == "__main__":
    main()
