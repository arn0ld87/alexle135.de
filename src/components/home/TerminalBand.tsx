import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ds';

/** "Terminal-Missionen" band: editorial pitch + a framed terminal mock. */
export function TerminalBand() {
  return (
    <section id="terminal" style={{ paddingBlock: 'var(--section-gap)' }}>
      <div className="ds-shell">
        <div className="term-band">
          <div>
            <div className="ds-kicker" style={{ marginBottom: 18 }}>
              &gt;_ Interaktiv
            </div>
            <h2
              className="ds-serif"
              style={{
                fontSize: 'var(--text-display-m)',
                margin: '0 0 16px',
                color: 'var(--text-primary)',
              }}
            >
              Terminal-Missionen im Browser
            </h2>
            <p
              style={{
                fontSize: 'var(--ds-text-lead)',
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                maxWidth: '42ch',
                margin: '0 0 30px',
              }}
            >
              Echte Linux- und Windows-Abläufe üben — direkt im Browser, ohne Installation. Powered
              by WebContainer.
            </p>
            <Button href="/apps/" variant="primary" size="lg" iconRight={<ArrowRight size={18} />}>
              Mission starten
            </Button>
          </div>
          <div
            className="ds-reticle"
            data-accent
            style={{
              ['--tick' as string]: '20px',
              padding: 12,
              borderRadius: 'var(--ds-radius-lg)',
            }}
          >
            <div
              style={{
                background: 'var(--mono-975)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--ds-radius-md)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '11px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--mono-600)' }}
                />
                <span
                  style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--mono-600)' }}
                />
                <span
                  style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--accent)' }}
                />
                <span
                  style={{
                    marginLeft: 8,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                    color: 'var(--text-faint)',
                  }}
                >
                  mission · rechteverwaltung
                </span>
              </div>
              <div
                style={{
                  padding: '16px 16px 20px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  lineHeight: 1.85,
                }}
              >
                <div>
                  <span style={{ color: 'var(--accent)' }}>user@mission</span>
                  <span style={{ color: 'var(--text-faint)' }}>:~$</span> ls -l deploy.sh
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  -rw-r--r-- 1 user user 482 deploy.sh
                </div>
                <div>
                  <span style={{ color: 'var(--accent)' }}>user@mission</span>
                  <span style={{ color: 'var(--text-faint)' }}>:~$</span> chmod +x deploy.sh
                </div>
                <div style={{ color: 'var(--accent)' }}>Aufgabe gelöst — +x gesetzt</div>
                <div>
                  <span style={{ color: 'var(--accent)' }}>user@mission</span>
                  <span style={{ color: 'var(--text-faint)' }}>:~$</span>{' '}
                  <span className="term-caret">▋</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TerminalBand;
