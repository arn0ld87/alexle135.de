import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SectionHead } from './SectionHead';

export interface BlogPostRow {
  n: string;
  title: string;
  href: string;
  cat: string;
  date: string;
  read: string;
}

export interface BlogProps {
  posts: BlogPostRow[];
}

export function Blog({ posts }: BlogProps) {
  return (
    <section id="blog" className="blog-section">
      <div className="ds-shell">
        <SectionHead kicker="// Notizen aus der Praxis" title="Blog" id="home-blog-title" />
        <div className="blog-list">
          {posts.map((p) => (
            <a key={p.href} href={p.href} className="post-row">
              <span className="post-num">{p.n}</span>
              <div>
                <h3 className="ds-serif post-title">{p.title}</h3>
                <div className="post-meta">
                  <span>{p.cat}</span>
                  <span>{p.date}</span>
                  <span>{p.read}</span>
                </div>
              </div>
              <span className="post-arrow">
                <ArrowRight size={20} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Blog;
