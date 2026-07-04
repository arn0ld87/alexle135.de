#!/usr/bin/env python3
"""
Generate Google Sheets CSV Template for Threads Automation
Extracts blog article metadata and creates CSV for N8N workflow
"""

import os
import re
import csv
from pathlib import Path
from datetime import datetime

# Paths
BLOG_DIR = Path(__file__).parent.parent / "src" / "content" / "blog"
OUTPUT_CSV = Path(__file__).parent.parent / "threads-blog-posts.csv"

def extract_frontmatter(markdown_file):
    """Extract YAML frontmatter from markdown file"""
    with open(markdown_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match YAML frontmatter (between --- delimiters)
    match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
    if not match:
        return None

    frontmatter_text = match.group(1)
    metadata = {}

    # Parse YAML fields (simple parser, handles strings and arrays)
    for line in frontmatter_text.split('\n'):
        if ':' in line and not line.strip().startswith('-'):
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")

            # Handle tags array
            if key == 'tags' and not value:
                # Next lines are array items
                continue

            metadata[key] = value
        elif line.strip().startswith('-') and 'tags' in frontmatter_text:
            # Array item (tag)
            tag = line.strip('- ').strip()
            if 'tags' not in metadata:
                metadata['tags'] = []
            if isinstance(metadata['tags'], list):
                metadata['tags'].append(tag)

    # Convert tags list to comma-separated string
    if 'tags' in metadata and isinstance(metadata['tags'], list):
        metadata['tags'] = ', '.join(metadata['tags'])

    return metadata

def generate_slug(title):
    """Generate URL slug from title"""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug)
    slug = slug.strip('-')
    return slug

def main():
    articles = []

    print(f"📁 Scanning blog directory: {BLOG_DIR}")

    # Process all markdown files
    for md_file in sorted(BLOG_DIR.glob("*.md")):
        metadata = extract_frontmatter(md_file)

        if not metadata:
            print(f"⚠️  No frontmatter found in {md_file.name}")
            continue

        # Extract relevant fields
        title = metadata.get('title', 'Untitled')
        published_at = metadata.get('publishedAt') or metadata.get('pubDate', '')
        hero_image = metadata.get('heroImage', '')
        summary = metadata.get('summary', metadata.get('description', ''))
        tags = metadata.get('tags', '')

        # Generate slug and URL
        slug = generate_slug(title)
        url = f"https://alexle135.de/blog/{slug}/"

        # Create article entry
        article = {
            'Title': title,
            'PublishedAt': published_at,
            'HeroImage': hero_image,
            'Summary': summary,
            'Tags': tags,
            'URL': url,
            'Status': 'pending',
            'ThreadsPostID': '',
            'PublishedToThreadsAt': ''
        }

        articles.append(article)
        print(f"✅ {title[:50]}... ({published_at})")

    # Filter articles with dates and sort chronologically
    dated_articles = [a for a in articles if a['PublishedAt']]
    dated_articles.sort(key=lambda x: x['PublishedAt'])

    # Add undated articles at the end
    undated_articles = [a for a in articles if not a['PublishedAt']]
    all_articles = dated_articles + undated_articles

    # Add ID column (1-indexed)
    for idx, article in enumerate(all_articles, start=1):
        article['ID'] = idx

    # Write CSV
    fieldnames = ['ID', 'Title', 'PublishedAt', 'HeroImage', 'Summary', 'Tags', 'URL', 'Status', 'ThreadsPostID', 'PublishedToThreadsAt']

    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_articles)

    print(f"\n✨ CSV generated successfully!")
    print(f"📊 Total articles: {len(all_articles)}")
    print(f"   - With dates: {len(dated_articles)}")
    print(f"   - Without dates: {len(undated_articles)}")
    print(f"📄 Output: {OUTPUT_CSV}")
    print(f"\n🔗 Next steps:")
    print(f"   1. Open Google Sheets")
    print(f"   2. File → Import → Upload")
    print(f"   3. Upload: {OUTPUT_CSV}")
    print(f"   4. Name the sheet: 'Blog_Posts'")

if __name__ == "__main__":
    main()
