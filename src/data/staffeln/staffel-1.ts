// Staffel 1 „Krimi auf Alex' Server“ (#395). Vorerst nur ein Platzhalter-Vorfall, damit Pager
// (#397) und Layout (#399) bauen können; die echten Vorfälle 0–8 kommen mit #400 und #401.
// Alles fiktiv. Shell-Snippets: kein `${...}` in Template-Literalen.
import { tools } from '../../lib/missions/glossar';
import type { Staffel } from '../../lib/missions/staffelTypes';
import { CHOWN_HOME, RESET_HOME } from '../missions/shared';
import { BEGRUESSUNG } from './begruessung';

export const staffel1: Staffel = {
  id: 'staffel-1',
  titel: "Krimi auf Alex' Server",
  vorfaelle: [
    {
      nr: 0,
      id: 'erster-tag',
      titel: 'Erster Tag',
      setup: `${RESET_HOME}
${CHOWN_HOME}`,
      schritte: [
        {
          id: 'notizen',
          title: 'Platz für Notizen',
          pager: [
            ...BEGRUESSUNG,
            'Leg dir in deinem Home einen Ordner `notizen` an. Da kommt alles rein, was dir auffällt.',
          ],
          verify: '[ -d notizen ]',
          tipps: [
            'Ordner legst du mit einem eigenen Befehl an, nicht mit einer Datei.',
            '`mkdir` heißt „make directory“.',
            'mkdir notizen',
          ],
          failMessage: 'Noch kein Ordner `notizen` in deinem Home.',
        },
      ],
      werkzeuge: tools('pwd', 'ls', 'mkdir'),
      beweisstueck: {
        id: 'dienstplan',
        titel: 'Dienstplan',
        beschreibung: 'Alex ist zwei Wochen weg. Wer sonst noch Zugriff hat, steht nirgends.',
        code: 'S1-V0-DIENSTPLAN',
      },
      szene: ['Alex schickt ein Foto: Liegestuhl, Sonnenbrille, Laptop. Natürlich der Laptop.'],
    },
  ],
  abzeichen: [
    {
      id: 'ohne-tipp',
      titel: 'Ohne Spickzettel',
      beschreibung: 'Einen Vorfall gelöst, ohne Alex zu fragen.',
      regel: { art: 'ohne-tipp' },
    },
    {
      id: 'schnell',
      titel: 'Schneller als der Kaffee',
      beschreibung: 'Einen Vorfall in unter 5 Minuten gelöst.',
      regel: { art: 'schnell', ms: 5 * 60_000 },
    },
    {
      id: 'nie-loesung',
      titel: 'Eigene Spur',
      beschreibung: 'Die ganze Akte ohne Lösung geschafft.',
      regel: { art: 'nie-loesung' },
    },
    {
      id: 'rote-prompts',
      titel: 'Rot ist auch eine Farbe',
      beschreibung: 'Zehn rote Prompts – wer nichts kaputt macht, lernt nichts.',
      regel: { art: 'rote-prompts', anzahl: 10 },
    },
  ],
};
