// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { platzhalter } from '../../../data/staffeln/staffel-2/platzhalter';
import { pruefeDaten } from '../ermittlung';
import { activeMarkerScript } from '../missionBridge';
import { STAFFEL2_HOSTNAME, rahmenSetupSkript } from '../staffel2Rahmen';

describe('rahmenSetupSkript', () => {
  it('wirft bei ungültigen Hostnamen', () => {
    for (const hostname of ['Rw', '-x', '', 'a'.repeat(32)]) {
      expect(() => rahmenSetupSkript(hostname)).toThrow();
    }
  });

  it('setzt die fünf Bestandteile in der richtigen Reihenfolge', () => {
    const skript = rahmenSetupSkript();
    const stellen = [
      skript.indexOf(`hostname ${STAFFEL2_HOSTNAME}`),
      skript.indexOf('/etc/hostname'),
      skript.indexOf('/etc/hosts'),
      skript.indexOf('install -d -o azubi'),
      skript.indexOf('mkdir -p /run/mission'),
      skript.indexOf(activeMarkerScript(true)),
      skript.indexOf('syslogd -O /var/log/messages'),
      skript.indexOf('kill -HUP'),
    ];
    expect(stellen.every((stelle) => stelle >= 0)).toBe(true);
    expect(stellen).toEqual([...stellen].sort((a, b) => a - b));
  });

  it('enthält genau den aktiven Missionsmarker', () => {
    expect(rahmenSetupSkript()).toContain(activeMarkerScript(true));
  });

  it('HUPT die Login-Shell ohne -x, weil BusyBox die Kommandozeile prüft', () => {
    const skript = rahmenSetupSkript();
    expect(skript).toContain('for p in $(pgrep -u azubi bash); do kill -HUP "$p"; done');
    expect(skript).not.toContain('pgrep -u azubi -x bash');
  });

  it('endet mit exit 0 und besteht die Bash-Syntaxprüfung', () => {
    const skript = rahmenSetupSkript();
    expect(skript.trimEnd().endsWith('exit 0')).toBe(true);
    expect(() => execFileSync('bash', ['-n', '-c', skript])).not.toThrow();
  });
});

describe('platzhalter', () => {
  it('ist eine gültige Ermittlung', () => {
    expect(pruefeDaten(platzhalter)).toEqual([]);
  });

  it('lässt alle Skripte die Bash-Syntaxprüfung bestehen', () => {
    const skripte = [
      platzhalter.setup,
      ...platzhalter.spuren.flatMap((spur) => spur.schritte.map((schritt) => schritt.verify)),
      ...platzhalter.vorwurf.belege.map((beleg) => beleg.verify),
      platzhalter.einsatzrahmen.verstoss,
      ...platzhalter.ansichten.map((ansicht) => ansicht.abfrage),
    ];
    for (const skript of skripte) {
      expect(() => execFileSync('bash', ['-n', '-c', skript])).not.toThrow();
    }
  });
});
