import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose max-w-none [--tw-prose-body:var(--ink)] [--tw-prose-bullets:var(--muted)] [--tw-prose-counters:var(--muted)] [--tw-prose-quotes:var(--ink)] [--tw-prose-hr:var(--line)] prose-headings:text-[color:var(--ink)] prose-p:text-[color:var(--ink)] prose-a:text-[color:var(--ink)] prose-a:decoration-[color:var(--accent)] prose-code:text-[color:var(--ink)] prose-pre:bg-[color:var(--panel)] prose-pre:text-[color:var(--panel-text)] prose-strong:text-[color:var(--ink)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
