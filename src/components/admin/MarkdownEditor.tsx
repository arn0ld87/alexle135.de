import React, { useState } from 'react';

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
}

export default function MarkdownEditor({ initialValue = '', onChange }: MarkdownEditorProps) {
  const [content, setContent] = useState(initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setContent(newVal);
    if (onChange) onChange(newVal);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[600px]">
      <div className="flex flex-col h-full">
        <label className="text-sm font-medium text-[color:var(--muted)] mb-2">
          Editor (Markdown)
        </label>
        <textarea
          // name ist Pflicht: der Submit-Handler in admin/posts/[id].astro
          // findet den Editor über `textarea[name="content"]`. Ohne das
          // Attribut lief der Selector ins Leere und jeder Speichervorgang
          // schrieb still den ursprünglich geladenen Body zurück.
          name="content"
          className="flex-1 w-full bg-[color:var(--paper)] border border-[color:var(--muted)] p-4 text-[color:var(--ink)] font-mono text-sm focus:outline-none focus-visible:border-[color:var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] resize-none"
          value={content}
          onChange={handleChange}
          placeholder="# Titel..."
        />
      </div>
      <div className="flex flex-col h-full">
        <label className="text-sm font-medium text-[color:var(--muted)] mb-2">Preview</label>
        <div className="flex-1 w-full bg-[color:color-mix(in_srgb,var(--ink)_4%,var(--paper))] border border-[color:var(--line)] p-4 text-[color:var(--ink)] overflow-y-auto prose prose-sm max-w-none">
          {/* Simple Preview - for full MD support we'd need a parser like marked */}
          <pre className="whitespace-pre-wrap font-sans">{content}</pre>
        </div>
      </div>
    </div>
  );
}
