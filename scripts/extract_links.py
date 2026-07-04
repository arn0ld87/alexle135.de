#!/usr/bin/env python3
import os
import csv
from html.parser import HTMLParser

ROOT = '/var/www/html'
EXCLUDE_DIRS = {'_astro','node_modules','public'}

class LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        for (k,v) in attrs:
            if k in ('href','src','action') and v:
                self.links.append(v)
    def handle_startendtag(self, tag, attrs):
        for (k,v) in attrs:
            if k in ('href','src','action') and v:
                self.links.append(v)

out_path = os.path.join(ROOT, 'all_links.csv')
rows = []
seen = set()
for dirpath, dirnames, filenames in os.walk(ROOT):
    # skip excluded dirs
    parts = set(dirpath.split(os.sep))
    if parts & EXCLUDE_DIRS:
        continue
    for fn in filenames:
        if not fn.endswith('.html'):
            continue
        path = os.path.join(dirpath, fn)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = f.read()
        except Exception as e:
            # skip unreadable
            continue
        parser = LinkExtractor()
        try:
            parser.feed(data)
        except Exception:
            # malformed HTML - best-effort
            pass
        for link in parser.links:
            key = (link, path)
            if key in seen:
                continue
            seen.add(key)
            rows.append((path, link))

# write CSV
with open(out_path, 'w', newline='', encoding='utf-8') as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow(['source_file','link'])
    for src,link in rows:
        writer.writerow([src,link])

print(f'Wrote {len(rows)} links to {out_path}')
