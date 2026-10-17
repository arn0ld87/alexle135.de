import React from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Button, Input } from '../ds';

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Homepage contact section. Posts JSON to the real, CSRF/rate-limit/honeypot
 * protected `/api/contact` endpoint — the hidden `website` field is the
 * honeypot and must stay present and empty for humans.
 */
export function Contact() {
  const [status, setStatus] = React.useState<Status>('idle');
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    const form = e.currentTarget;
    const data = new FormData(form);
    // Honeypot: bots fill `website`; humans leave it empty.
    if (String(data.get('website') || '').trim().length > 0) {
      setStatus('sent');
      return;
    }
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
          website: data.get('website') || '',
        }),
      });
      if (res.ok) {
        window.gtag?.('event', 'generate_lead', { form: 'home_contact' });
        setStatus('sent');
        form.reset();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Nachricht konnte nicht gesendet werden.');
        setStatus('error');
      }
    } catch {
      setError('Netzwerkfehler — bitte später erneut versuchen.');
      setStatus('error');
    }
  }

  return (
    <section id="kontakt" className="contact-section" data-surface="panel">
      <div className="ds-shell">
        <div className="contact-grid">
          <div>
            <p className="contact-kicker">04 / KONTAKT</p>
            <h2 className="ds-display-xl contact-title">
              Schreib mir eine <span className="contact-accent">Nachricht</span>
            </h2>
            <p className="contact-lead">
              Infrastruktur, Automatisierung oder ein KI-Tooling-Projekt? Kurze Nachricht genügt —
              Antwort folgt in der Regel werktags innerhalb eines Tages.
            </p>
          </div>
          <div className="contact-panel">
            {status === 'sent' ? (
              <div className="contact-success">
                <span className="contact-check">
                  <svg
                    viewBox="0 0 24 24"
                    width="26"
                    height="26"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div className="ds-display-s contact-success-title">Nachricht gesendet</div>
                <div className="contact-success-sub">
                  Antwort folgt in der Regel innerhalb eines Tages.
                </div>
              </div>
            ) : (
              <form
                action="/api/contact"
                method="post"
                onSubmit={handleSubmit}
                className="contact-form"
              >
                <Input
                  label="Name"
                  name="name"
                  placeholder="Ihr Name"
                  required
                  minLength={1}
                  maxLength={120}
                  autoComplete="name"
                />
                <Input
                  label="E-Mail"
                  name="email"
                  type="email"
                  placeholder="du@beispiel.de"
                  required
                  maxLength={254}
                  autoComplete="email"
                  icon={<Mail size={17} />}
                />
                <Input
                  label="Nachricht"
                  name="message"
                  multiline
                  placeholder="Worum geht es?"
                  required
                  minLength={10}
                  maxLength={5000}
                />
                {/* Honeypot — visually hidden, not announced to screen readers. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="contact-honeypot"
                />
                {status === 'error' && error && (
                  <p role="alert" className="contact-error">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  block
                  loading={status === 'sending'}
                  iconRight={<ArrowRight size={18} />}
                >
                  Senden
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Contact;
