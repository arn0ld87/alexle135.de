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
        <label className="text-sm font-medium text-gray-300 mb-2">Editor (Markdown)</label>
        <textarea
          className="flex-1 w-full bg-gray-950/50 border border-white/10 rounded-lg p-4 text-gray-200 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          value={content}
          onChange={handleChange}
          placeholder="# Titel..."
        />
      </div>
      <div className="flex flex-col h-full">
        <label className="text-sm font-medium text-gray-300 mb-2">Preview</label>
        <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-lg p-4 text-gray-200 overflow-y-auto prose prose-invert prose-sm max-w-none">
          {/* Simple Preview - for full MD support we'd need a parser like marked */}
          <pre className="whitespace-pre-wrap font-sans">{content}</pre>
        </div>
      </div>
    </div>
  );
}
