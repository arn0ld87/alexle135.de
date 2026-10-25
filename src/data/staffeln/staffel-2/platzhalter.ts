import { AKTENWAND_ABFRAGE } from '../../../lib/missions/aktenwand';
import { EINSATZRAHMEN_VERSTOSS } from '../../../lib/missions/einsatzrahmenSetup';
import type { Ermittlung } from '../../../lib/missions/ermittlungTypes';

/**
 * Platzhalter für das Gerüst von Staffel 2. Enthält bewusst keine Story aus dem Konzept;
 * Ticket 9 ersetzt ihn durch Episode 1.
 */
export const platzhalter: Ermittlung = {
  nr: 1,
  id: 'platzhalter',
  titel: 'Platzhalter',
  hostname: 'rw-srv01',
  setup: 'true',
  ansichten: [
    {
      id: 'raum',
      art: 'raum',
      titel: 'Büro',
      abfrage: `printf 'host\\t%s\\n' "$(hostname)"
printf 'konto\\t%s\\n' "$(id -un)"`,
      hotspots: [
        { id: 'host', label: 'Hostname', x: 80, y: 80, w: 240, h: 100, schluessel: 'host' },
        { id: 'konto', label: 'Konto', x: 520, y: 320, w: 240, h: 100, schluessel: 'konto' },
      ],
    },
    {
      id: 'aktenwand',
      art: 'aktenwand',
      titel: 'Aktenwand',
      abfrage: AKTENWAND_ABFRAGE,
    },
  ],
  spuren: [
    {
      id: 'ankommen',
      titel: 'Ankommen',
      schritte: [
        {
          art: 'sichern',
          id: 'notiz',
          title: 'Lege eine Notiz an',
          pager: ['Leg in ~/belege eine Datei notiz.txt mit beliebigem Inhalt an.'],
          verify: 'test -s /home/azubi/belege/notiz.txt',
          tipps: [
            'Die Belege liegen im Ordner belege.',
            'touch ~/belege/notiz.txt',
            'printf x > ~/belege/notiz.txt',
          ],
        },
        {
          art: 'reparieren',
          id: 'abschluss',
          title: 'Ergänze fertig in notiz.txt',
          pager: ['Ergänze in ~/belege/notiz.txt eine eigene Zeile mit fertig.'],
          verify: 'grep -qxF fertig /home/azubi/belege/notiz.txt',
          tipps: [
            'Die Zeile muss genau fertig heißen.',
            "printf 'fertig\\n' >> ~/belege/notiz.txt",
            "printf 'fertig\\n' >> ~/belege/notiz.txt",
          ],
        },
      ],
    },
    {
      id: 'protokoll',
      titel: 'Protokoll',
      schritte: [
        {
          art: 'sichern',
          id: 'protokoll',
          title: 'Lege ein Protokoll an',
          pager: ['Leg in ~/belege eine Datei protokoll.txt mit beliebigem Inhalt an.'],
          verify: 'test -s /home/azubi/belege/protokoll.txt',
          tipps: [
            'Die Belege liegen im Ordner belege.',
            'touch ~/belege/protokoll.txt',
            'printf x > ~/belege/protokoll.txt',
          ],
        },
        {
          art: 'ordnen',
          id: 'abschluss',
          title: 'Ergänze fertig in protokoll.txt',
          pager: ['Ergänze in ~/belege/protokoll.txt eine eigene Zeile mit fertig.'],
          verify: 'grep -qxF fertig /home/azubi/belege/protokoll.txt',
          tipps: [
            'Die Zeile muss genau fertig heißen.',
            "printf 'fertig\\n' >> ~/belege/protokoll.txt",
            "printf 'fertig\\n' >> ~/belege/protokoll.txt",
          ],
        },
      ],
    },
  ],
  vorwurf: {
    verdaechtige: [
      {
        id: 'person-a',
        name: 'Person A',
        rolle: 'Rolle A',
        portraet: '/missions/figur/alexander-zeigt.webp',
      },
      {
        id: 'person-b',
        name: 'Person B',
        rolle: 'Rolle B',
        portraet: '/missions/figur/alexander-zeigt.webp',
      },
      {
        id: 'person-c',
        name: 'Person C',
        rolle: 'Rolle C',
        portraet: '/missions/figur/alexander-zeigt.webp',
      },
    ],
    taeterId: 'person-a',
    belege: [
      {
        id: 'notiz',
        beschreibung: 'Eine Notiz in den Belegen.',
        spurId: 'ankommen',
        stuetzt: 'person-a',
        verify: 'test -s /home/azubi/belege/notiz.txt',
      },
      {
        id: 'protokoll',
        beschreibung: 'Eine zweite Notiz in den Belegen.',
        spurId: 'protokoll',
        stuetzt: 'person-a',
        verify: 'test -s /home/azubi/belege/protokoll.txt',
      },
    ],
    mindestBelege: 1,
    jedeSpur: true,
    antworten: {
      richtig: ['Das ist richtig.'],
      falschePerson: ['Diese Person war es nicht.'],
      zuWenigBelege: ['Die Belege reichen noch nicht.'],
      gesperrt: ['Erst die laufende Prüfung abschließen.'],
    },
  },
  einsatzrahmen: {
    text: [
      'Diagnose außerhalb des ausgeschlossenen Ordners ist erlaubt.',
      'Eigene Belege unter ~/belege/ darfst du anlegen und ändern.',
      '/home/nadia/ ist ausgeschlossen. Ein Zugriff dort hat erzählerische Folgen.',
    ],
    verstoss: EINSATZRAHMEN_VERSTOSS,
    folge: [
      'Margit wird misstrauisch: Jemand hat im ausgeschlossenen Ordner gelesen.',
      'Der Vorwurf ist vorübergehend gesperrt. Ein weiterer erkannter Beleg hilft, spätestens drei vollständige Prüfungen öffnen ihn wieder.',
    ],
  },
  beweisstueck: {
    id: 'notiz',
    titel: 'Notiz',
    beschreibung: 'Eine kurze Notiz.',
    code: 'notiz.txt',
  },
  szene: ['Der Platzhalter für Staffel 2.'],
};
