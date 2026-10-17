import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ds';

/**
 * Band „Terminal-Missionen“: Einladung und ein gerahmtes Terminal-Fenster.
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
            <h2 className="ds-display-m term-band__title">Terminal-Missionen im Browser</h2>
            <p className="term-band__lead">
              Echte Linux- und Windows-Abläufe üben — direkt im Browser, ohne Installation. Powered
              by WebContainer.
            </p>
            <Button href="/apps/" variant="primary" size="lg" iconRight={<ArrowRight size={18} />}>
              Mission starten
            </Button>
          </div>
          <div className="term-window">
            <div className="term-window__bar">
              <span className="term-window__dot" />
              <span className="term-window__dot" />
              <span className="term-window__dot" data-active="" />
              <span className="term-window__title">mission · rechteverwaltung</span>
            </div>
            <div className="term-window__body">
              <div>
                <span className="term-window__user">user@mission</span>
                <span className="term-window__sep">:~$</span> ls -l deploy.sh
              </div>
              <div>-rw-r--r-- 1 user user 482 deploy.sh</div>
              <div>
                <span className="term-window__user">user@mission</span>
                <span className="term-window__sep">:~$</span> chmod +x deploy.sh
              </div>
              <div className="term-window__ok">Aufgabe gelöst — +x gesetzt</div>
              <div>
                <span className="term-window__user">user@mission</span>
                <span className="term-window__sep">:~$</span> <span className="term-caret">▋</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TerminalBand;
