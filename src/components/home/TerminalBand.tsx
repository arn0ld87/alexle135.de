import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ds';

/**
 * Band „Ein Linux-Krimi · Fall Kehrwoche“: Einladung zur Projektseite und ein gerahmtes
 * Terminal-Fenster mit einem Ausschnitt aus Episode 2 (Prompt wie in der VM: `azubi@alex-schneider`).
 * Dunkle Terminal-Insel in beiden Varianten (Fläche --terminal-bg, D-13, D-45). Die Regeln stehen
 * in `systemwerk.css` unter „TerminalBand“; `data-surface="panel"` liefert dem Button die
 * Panel-Schreibweise (invertiert).
 */
export function TerminalBand() {
  return (
    <section id="terminal" className="term-section">
      <div className="ds-shell">
        <div className="term-band" data-surface="panel">
          <div className="term-band__copy">
            <p className="term-band__kicker">&gt;_ Interaktiv</p>
            <h2 className="ds-display-m term-band__title">Ein Linux-Krimi · Fall Kehrwoche</h2>
            <p className="term-band__lead">
              Echtes Alpine Linux im Browser, ohne Installation und ohne Konto. Alex ist im Urlaub,
              auf seinem Server räumt jemand auf. Du bist sein Azubi am ersten Tag: Episoden 0 bis
              8.
            </p>
            <Button
              href="/projekte/terminal-missionen/"
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={18} />}
            >
              Fall öffnen
            </Button>
          </div>
          <div className="term-window">
            <div className="term-window__bar">
              <span className="term-window__dot" />
              <span className="term-window__dot" />
              <span className="term-window__dot" data-active="" />
              <span className="term-window__title">Episode 2 · Skript startet nicht</span>
            </div>
            <div className="term-window__body">
              <div>
                <span className="term-window__user">azubi</span>
                <span className="term-window__sep">@alex-schneider:~$</span> ls -l
                /srv/www/bin/deploy.sh
              </div>
              <div>-rw-r--r-- 1 azubi azubi 214 /srv/www/bin/deploy.sh</div>
              <div>
                <span className="term-window__user">azubi</span>
                <span className="term-window__sep">@alex-schneider:~$</span> chmod u+x
                /srv/www/bin/deploy.sh
              </div>
              <div className="term-window__ok">Ausführungsrecht zurück</div>
              <div>
                <span className="term-window__user">azubi</span>
                <span className="term-window__sep">@alex-schneider:~$</span>{' '}
                <span className="term-caret">▋</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TerminalBand;
