#!/usr/bin/env python3
"""
Filter existing pages-only CSV to exclude URLs that map to files under `dist/`,
and paths under `/dogs/` or `/imprint` (and their variants).

Writes: /var/www/html/gtm_pages_pagesonly.filtered.csv

Run: python3 /var/www/html/scripts/filter_gtm_pages.py
"""
import csv
import os
from urllib.parse import urlparse

BASE_DIR = '/var/www/html'
IN_CSV = os.path.join(BASE_DIR, 'gtm_pages_pagesonly.csv')
OUT_CSV = os.path.join(BASE_DIR, 'gtm_pages_pagesonly.filtered.csv')

def should_exclude(url):
    # exclude if path starts with /dogs/ or is /imprint (or /imprint/)
    p = urlparse(url).path or ''
    if p.startswith('/dogs/'):
        return True, 'dogs'
    if p.rstrip('/') == '/imprint' or p.rstrip('/') == '/imprint.html':
        return True, 'imprint'
    # resolve to filesystem path and exclude if under /dist/
    fs_path = os.path.join(BASE_DIR, p.lstrip('/'))
    # check common candidates (index.html)
    candidates = [fs_path, fs_path + '.html', os.path.join(fs_path, 'index.html')]
    for c in candidates:
        if os.path.exists(c) and '/dist/' in os.path.normpath(c):
            return True, 'dist'
    # additional: if the url contains '/dist/' explicitly
    if '/dist/' in url:
        return True, 'dist'
    return False, ''

def main():
    if not os.path.isfile(IN_CSV):
        print('Input not found:', IN_CSV)
        return
    kept = []
    removed = []
    with open(IN_CSV, newline='', encoding='utf-8') as fh:
        reader = csv.reader(fh)
        for i,row in enumerate(reader):
            if i == 0:
                kept.append(row)
                continue
            if not row:
                continue
            url = row[0].strip()
            ex, reason = should_exclude(url)
            if ex:
                removed.append((url, reason))
            else:
                kept.append([url])

    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as outfh:
        writer = csv.writer(outfh)
        for r in kept:
            writer.writerow(r)

    print(f'WROTE {len(kept)-1} lines to {OUT_CSV} (removed {len(removed)} entries)')
    if removed:
        print('Removed examples:')
        for url,reason in removed[:20]:
            print(' -', url, '(', reason, ')')

if __name__ == "__main__":
    main()
