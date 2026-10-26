// Seite von Staffel 2: wählt die Episode (Wahl per ?episode= oder die erste ungelöste), zeigt die
// Kopfzeile mit Episodenwahl und speichert den Abschluss im geteilten Staffel-Store (ADR 0005,
// 0007). Läuft nur im Browser (client:only); der Server weiß nichts vom Stand. Laufende Episoden
// werden nicht gespeichert.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { EpisodeKarte } from '../../data/staffeln/staffel-2';
import type { Ermittlung } from '../../lib/missions/ermittlungTypes';
import type { MissionTool } from '../../lib/missions/missionTypes';
import type { AkteEintrag } from '../../lib/missions/staffel';
import {
  createStaffelStore,
  STAFFEL2_ID,
  STAFFEL_STORE_KEY,
} from '../../lib/missions/staffelStore';
import ErmittlungApp from './ErmittlungApp';
import type { WeiterLink } from './ErmittlungsAbschluss';
import Kopfzeile from './Kopfzeile';

const VERLASSEN_HREF = '/projekte/terminal-missionen/';

// Tokens der Spieloberfläche (#170): nur am Wurzelcontainer, nicht global.
const LK_TOKEN = {
  '--lk-ink': '#ede6da',
  '--lk-muted': '#b3aa9c',
  '--lk-dim': '#8e8679',
  '--lk-line': 'rgba(237, 230, 218, 0.1)',
  '--lk-line-strong': 'rgba(237, 230, 218, 0.2)',
  '--lk-panel': 'rgba(15, 21, 30, 0.84)',
  '--lk-panel-solid': '#121922',
  '--lk-accent': '#e8552f',
  '--lk-accent-fill': '#c8431e',
  '--lk-accent-fill-hover': '#d04820',
  '--lk-accent-soft': 'rgba(232, 85, 47, 0.15)',
  '--lk-accent-text': '#f4a58e',
  '--lk-ok': '#5cc98a',
  '--lk-warn': '#e9a443',
  '--lk-err': '#f08e72',
  '--lk-r': '10px',
  '--lk-r-sm': '7px',
  '--lk-shadow': '0 18px 40px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35)',
} as CSSProperties;

export interface SeitenEpisode {
  ermittlung: Ermittlung;
  werkzeuge: readonly MissionTool[];
  weiter?: WeiterLink;
}

interface Staffel2SeiteProps {
  /** Mindestens die gewählte Episode; ohne Wahl alle, damit die Seite die erste ungelöste findet. */
  episoden: readonly SeitenEpisode[];
  uebersicht: readonly EpisodeKarte[];
  /** Nummer aus `?episode=`; null, wenn der Aufruf keine Wahl enthält. */
  gewaehlt: number | null;
  /** Wechselt die Seite; Standard ist ein Seitenaufruf. */
  navigiere?: (href: string) => void;
  /** Adresse nach dem Löschen: ohne Wahl, also wieder die erste Episode. */
  startHref?: string;
}

export default function Staffel2Seite(props: Staffel2SeiteProps) {
  const { episoden, uebersicht, gewaehlt, navigiere, startHref = uebersicht[0]?.href } = props;
  const store = useMemo(() => createStaffelStore(), []);
  const [akte, setAkte] = useState(() => store.read(STAFFEL2_ID).akte);

  // Die Episode wird einmal beim Laden gewählt; ein Abschluss wechselt sie nicht unter den Händen.
  const [aktiv] = useState(() => {
    const treffer = episoden.find((e) => e.ermittlung.nr === gewaehlt);
    if (treffer) return treffer;
    const offen = episoden.find((e) => !(e.ermittlung.id in akte));
    return offen ?? episoden[episoden.length - 1];
  });

  // Ein zweiter Tab kann Episoden lösen oder den Fortschritt löschen.
  useEffect(() => {
    const aufStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STAFFEL_STORE_KEY) setAkte(store.read(STAFFEL2_ID).akte);
    };
    window.addEventListener('storage', aufStorage);
    return () => window.removeEventListener('storage', aufStorage);
  }, [store]);

  const speichere = useCallback(
    (abschluss: AkteEintrag) => {
      store.loeseEpisode(STAFFEL2_ID, aktiv.ermittlung.id, abschluss);
      setAkte(store.read(STAFFEL2_ID).akte);
    },
    [aktiv, store]
  );

  const loesche = useCallback(() => {
    store.loescheStaffel(STAFFEL2_ID);
    (navigiere ?? ((href) => window.location.assign(href)))(startHref ?? '');
  }, [navigiere, startHref, store]);

  const geloest = useMemo(
    () => new Set(uebersicht.filter((e) => e.id in akte).map((e) => e.nr)),
    [akte, uebersicht]
  );

  // Spielmodus (#170): Die Seite füllt das Fenster, die Ermittlung nimmt den Rest der Höhe.
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={LK_TOKEN}>
      <Kopfzeile
        episoden={uebersicht}
        geloest={geloest}
        aktuell={aktiv.ermittlung.nr}
        verlassenHref={VERLASSEN_HREF}
        onWaehle={navigiere ?? ((href) => window.location.assign(href))}
        onLoeschen={loesche}
      />
      <main className="flex min-h-0 flex-1 flex-col px-3 pt-3 pb-3 sm:px-6">
        <ErmittlungApp
          key={aktiv.ermittlung.nr}
          ermittlung={aktiv.ermittlung}
          werkzeuge={aktiv.werkzeuge}
          weiter={aktiv.weiter}
          onGeloest={speichere}
        />
      </main>
    </div>
  );
}
