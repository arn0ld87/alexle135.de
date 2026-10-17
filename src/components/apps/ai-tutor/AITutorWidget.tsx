import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, ChevronUp } from 'lucide-react';

export default function AITutorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Hi! Ich bin dein AI Tutor. Hast du Fragen zum Code oder Projekt?' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: 'ai', text: data.text }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: 'Sorry, ein Fehler ist aufgetreten. Bitte versuche es später.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Chat Window */}
      <div
        className={`bg-[var(--paper)] border border-[color:var(--ink)] w-[350px] max-w-[90vw] overflow-hidden transition-all duration-300 origin-bottom-right pointer-events-auto mb-4
        ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none h-0'}`}
      >
        <div className="p-4 border-b border-[color:var(--ink)] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[color:var(--ink)]" />
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
              AI Tutor
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="h-[400px] overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed
                ${
                  msg.role === 'user'
                    ? 'bg-[color:color-mix(in_srgb,var(--ink)_4%,var(--paper))] text-[color:var(--ink)]'
                    : 'text-[color:var(--ink)]'
                }`}
              >
                {msg.text.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < msg.text.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[color:color-mix(in_srgb,var(--ink)_4%,var(--paper))] px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[color:var(--muted)] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-[color:var(--muted)] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-[color:var(--muted)] rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-3 border-t border-[color:var(--ink)] flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Frag etwas..."
            className="flex-1 border border-[color:var(--muted)] bg-[color:var(--paper)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder-[color:var(--muted)] focus:outline-none focus-visible:border-[color:var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="p-2.5 bg-[var(--ink)] text-[color:var(--paper)] hover:bg-[var(--accent-strong)] active:bg-[var(--accent-press)] disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`pointer-events-auto p-4 transition-all duration-300 hover:scale-110 group
          ${isOpen ? 'bg-[var(--ink)]' : 'bg-[var(--accent-strong)]'}`}
      >
        {isOpen ? (
          <ChevronUp className="w-6 h-6 text-[color:var(--paper)] group-hover:rotate-180 transition-transform" />
        ) : (
          <Sparkles className="w-6 h-6 text-[color:var(--paper)] animate-pulse" />
        )}
      </button>
    </div>
  );
}
