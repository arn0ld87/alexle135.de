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
      abfrage: "printf 'host\\t%s\\n' rw-srv01",
    },
  ],
  spuren: [
    {
      id: 'ankommen',
      titel: 'Ankommen',
      schritte: [
        {
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
      ],
    },
  ],
  vorwurf: {
    verdaechtige: [
      { id: 'person-a', name: 'Person A', rolle: 'Rolle A', portraet: '/missions/figur/alexander-zeigt.webp' },
      { id: 'person-b', name: 'Person B', rolle: 'Rolle B', portraet: '/missions/figur/alexander-zeigt.webp' },
      { id: 'person-c', name: 'Person C', rolle: 'Rolle C', portraet: '/missions/figur/alexander-zeigt.webp' },
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
    text: ['Nur lesen, nichts verändern.'],
    verstoss: 'false',
    folge: ['Der Einsatzrahmen wurde verletzt.'],
  },
  beweisstueck: {
    id: 'notiz',
    titel: 'Notiz',
    beschreibung: 'Eine kurze Notiz.',
    code: 'notiz.txt',
  },
  szene: ['Der Platzhalter für Staffel 2.'],
};
