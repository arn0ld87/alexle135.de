#!/usr/bin/env python3
import os
import csv
from urllib.parse import urljoin, urlparse

ROOT = '/var/www/html'
INPUT = os.path.join(ROOT, 'all_links.csv')
OUTPUT = os.path.join(ROOT, 'all_links_abs.csv')
SITE_ROOT = 'https://alexle135.de'

def source_file_to_base_url(source_path):
    # remove ROOT prefix
    rel = source_path.replace(ROOT, '')
    if not rel.startswith('/'):
        rel = '/' + rel
    # if file is index.html -> base is directory
    if rel.endswith('/index.html'):
        base = SITE_ROOT + os.path.dirname(rel) + '/'
    elif rel.endswith('index.html') and os.path.dirname(rel) == '/':
        # root index.html
        base = SITE_ROOT + '/'
    else:
        # non-index file
        base = SITE_ROOT + rel
    return base

rows_out = []
count = 0
with open(INPUT, newline='', encoding='utf-8') as inf:
    reader = csv.DictReader(inf)
    for r in reader:
        src = r['source_file']
        link = r['link']
        base = source_file_to_base_url(src)
        abs_url = ''
        link_type = ''
        if link.startswith('mailto:'):
            abs_url = link
            link_type = 'mailto'
        elif link.startswith('tel:'):
            abs_url = link
            link_type = 'tel'
        elif link.startswith('//'):
            abs_url = 'https:' + link
            # classify external vs internal
            parsed = urlparse(abs_url)
            link_type = 'internal' if parsed.netloc.endswith('alexle135.de') else 'external'
        elif link.startswith('http://') or link.startswith('https://'):
            abs_url = link
            parsed = urlparse(abs_url)
            link_type = 'internal' if parsed.netloc.endswith('alexle135.de') else 'external'
        elif link.startswith('#'):
            abs_url = urljoin(base, link)
            link_type = 'fragment'
        else:
            # relative or absolute-path
            abs_url = urljoin(base, link)
            parsed = urlparse(abs_url)
            if parsed.scheme in ('http','https'):
                link_type = 'internal' if parsed.netloc.endswith('alexle135.de') else 'external'
            else:
                link_type = 'other'
        rows_out.append({'source_file': src, 'link': link, 'absolute_url': abs_url, 'link_type': link_type})
        count += 1

with open(OUTPUT, 'w', newline='', encoding='utf-8') as outf:
    writer = csv.DictWriter(outf, fieldnames=['source_file','link','absolute_url','link_type'])
    writer.writeheader()
    writer.writerows(rows_out)

print(f'Wrote {count} links with absolute URLs to {OUTPUT}')
