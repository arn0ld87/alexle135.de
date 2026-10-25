// Ermittlungslogik für Staffel 2 (Konzept §4, ADR 0004 und 0007): rein, ohne DOM, Uhr, Zufall
// oder VM. Sie sagt, welche Prüfungen nach einem Prompt fällig sind, baut daraus ein Bündel
// für einen RUN, liest dessen Ausgabe und führt Zustand und Vorwurf weiter.
import type {
  Ermittlung,
  ErmittlungsEreignis,
  ErmittlungsSchritt,
  ErmittlungsZustand,
  Pruefung,
  PruefungsAusgabe,
  Schrittart,
  Spur,
  VorwurfErgebnis,
} from './ermittlungTypes';

export const ID_MUSTER = /^[a-z0-9-]{1,40}$/;
export const pruefIdSchritt = (spurId: string, schrittId: string) => `s.${spurId}.${schrittId}`;
export const pruefIdDiagnose = (spurId: string, schrittId: string) => `d.${spurId}.${schrittId}`;
export const pruefIdBeleg = (belegId: string) => `b.${belegId}`;
export const PRUEF_ID_VERSTOSS = 'e.verstoss';
/** So viele vollständige Prüfungen nach einer Sperre, bis sie spätestens endet. */
export const SPERRE_PRUEFUNGEN = 3;

/** Alle Schrittarten (ADR 0009); alles andere ist in den Daten ein Fehler. */
const SCHRITTARTEN: readonly Schrittart[] = [
  'sichern',
  'eingreifen',
  'reparieren',
  'ablesen',
  'ordnen',
  'bearbeiten',
];
/** Jede Episode nutzt mindestens so viele verschiedene Schrittarten (ADR 0009). */
export const MINDEST_SCHRITTARTEN = 3;
/** Längste Diagnose-Meldung in Zeichen. */
export const DIAGNOSE_MAX_ZEICHEN = 200;
/** Erlaubte Zeichen einer getrimmten Antwort; alles andere lässt die App gar nicht erst laufen. */
export const ANTWORT_MUSTER = /^[A-Za-z0-9 .:_/-]+$/;
/** Timeout (ms) für die Prüfung einer Antwort in der VM. */
export const ANTWORT_TIMEOUT_MS = 10_000;

/** Prüft die Daten einer Episode und sammelt deutsche Fehlermeldungen; leer heißt gültig. */
export function pruefeDaten(e: Ermittlung): string[] {
  const fehler: string[] = [];
  const { spuren, ansichten, vorwurf, einsatzrahmen } = e;

  // 1. IDs, die nicht auf ID_MUSTER passen.
  for (const spur of spuren) {
    if (!ID_MUSTER.test(spur.id)) fehler.push(`Ungültige ID: Spur "${spur.id}"`);
    for (const schritt of spur.schritte) {
      if (!ID_MUSTER.test(schritt.id)) fehler.push(`Ungültige ID: Schritt "${schritt.id}"`);
    }
  }
  for (const beleg of vorwurf.belege) {
    if (!ID_MUSTER.test(beleg.id)) fehler.push(`Ungültige ID: Belegregel "${beleg.id}"`);
  }
  for (const person of vorwurf.verdaechtige) {
    if (!ID_MUSTER.test(person.id)) fehler.push(`Ungültige ID: Verdächtige "${person.id}"`);
  }
  for (const ansicht of ansichten) {
    if (!ID_MUSTER.test(ansicht.id)) fehler.push(`Ungültige ID: Ansicht "${ansicht.id}"`);
    for (const hotspot of ansicht.hotspots ?? []) {
      if (!ID_MUSTER.test(hotspot.id)) fehler.push(`Ungültige ID: Hotspot "${hotspot.id}"`);
    }
  }

  // 2. Doppelte IDs innerhalb einer Gruppe.
  const spurIds = new Set<string>();
  for (const spur of spuren) {
    if (spurIds.has(spur.id)) fehler.push(`Doppelte ID: Spur "${spur.id}"`);
    spurIds.add(spur.id);
    const schrittIds = new Set<string>();
    for (const schritt of spur.schritte) {
      if (schrittIds.has(schritt.id)) fehler.push(`Doppelte ID: Schritt "${schritt.id}"`);
      schrittIds.add(schritt.id);
    }
  }
  const belegIds = new Set<string>();
  for (const beleg of vorwurf.belege) {
    if (belegIds.has(beleg.id)) fehler.push(`Doppelte ID: Belegregel "${beleg.id}"`);
    belegIds.add(beleg.id);
  }
  const personIds = new Set<string>();
  for (const person of vorwurf.verdaechtige) {
    if (personIds.has(person.id)) fehler.push(`Doppelte ID: Verdächtige "${person.id}"`);
    personIds.add(person.id);
  }
  const ansichtIds = new Set<string>();
  for (const ansicht of ansichten) {
    if (ansichtIds.has(ansicht.id)) fehler.push(`Doppelte ID: Ansicht "${ansicht.id}"`);
    ansichtIds.add(ansicht.id);
    const hotspotIds = new Set<string>();
    for (const hotspot of ansicht.hotspots ?? []) {
      if (hotspotIds.has(hotspot.id)) fehler.push(`Doppelte ID: Hotspot "${hotspot.id}"`);
      hotspotIds.add(hotspot.id);
    }
  }

  // 3. Täter-ID.
  if (!personIds.has(vorwurf.taeterId)) {
    fehler.push(`Unbekannte Täter-ID: "${vorwurf.taeterId}"`);
  }

  // 4. Belege verweisen auf bekannte Verdächtige und Spuren.
  for (const beleg of vorwurf.belege) {
    if (!personIds.has(beleg.stuetzt)) {
      fehler.push(`Beleg "${beleg.id}" stützt keine Verdächtige: "${beleg.stuetzt}"`);
    }
    if (!spurIds.has(beleg.spurId)) {
      fehler.push(`Beleg "${beleg.id}" gehört zu keiner Spur: "${beleg.spurId}"`);
    }
  }

  // 5. mindestBelege passt zur Zahl der Belege gegen den Täter.
  const gegenTaeter = vorwurf.belege.filter((b) => b.stuetzt === vorwurf.taeterId);
  if (vorwurf.mindestBelege < 1 || vorwurf.mindestBelege > gegenTaeter.length) {
    fehler.push(`mindestBelege muss zwischen 1 und ${gegenTaeter.length} liegen`);
  }

  // 6. jedeSpur verlangt einen Beleg gegen den Täter aus jeder Spur.
  if (vorwurf.jedeSpur) {
    const spurenMitBeleg = new Set(gegenTaeter.map((b) => b.spurId));
    const fehlend = spuren.filter((s) => !spurenMitBeleg.has(s.id)).map((s) => s.id);
    if (fehlend.length) {
      fehler.push(
        `jedeSpur verlangt einen Beleg gegen den Täter aus jeder Spur; es fehlt: ${fehlend.join(', ')}`
      );
    }
  }

  // 7. Mindestens drei Verdächtige (KONZEPT §2).
  if (vorwurf.verdaechtige.length < 3) {
    fehler.push('Mindestens 3 Verdächtige nötig');
  }

  // 8. Keine leeren Skripte.
  for (const ansicht of ansichten) {
    if (!ansicht.abfrage.trim()) fehler.push(`Ansicht "${ansicht.id}": leere abfrage`);
  }
  for (const spur of spuren) {
    for (const schritt of spur.schritte) {
      if (!schritt.verify.trim()) fehler.push(`Schritt "${spur.id}/${schritt.id}": leeres verify`);
    }
  }
  for (const beleg of vorwurf.belege) {
    if (!beleg.verify.trim()) fehler.push(`Belegregel "${beleg.id}": leeres verify`);
  }
  if (!einsatzrahmen.verstoss.trim()) fehler.push('Einsatzrahmen: leeres verstoss');

  // 9. Schrittarten (ADR 0009).
  const arten = new Set<Schrittart>();
  for (const spur of spuren) {
    let vorige: Schrittart | null = null;
    for (const schritt of spur.schritte) {
      const name = `Schritt "${spur.id}/${schritt.id}"`;
      if (!SCHRITTARTEN.includes(schritt.art)) {
        fehler.push(`${name}: Schrittart fehlt oder ist unbekannt`);
        vorige = null;
        continue;
      }
      arten.add(schritt.art);
      if (schritt.art === 'ablesen' && !schritt.antwort) {
        fehler.push(`${name}: ablesen braucht eine antwort`);
      } else if (schritt.art !== 'ablesen' && schritt.antwort) {
        fehler.push(`${name}: antwort gibt es nur bei ablesen`);
      }
      if (schritt.art === vorige) {
        fehler.push(
          `Spur "${spur.id}": Schrittart "${schritt.art}" steht zweimal direkt hintereinander (bei ${schritt.id})`
        );
      }
      vorige = schritt.art;
    }
  }
  if (arten.size < MINDEST_SCHRITTARTEN) {
    fehler.push(`Mindestens ${MINDEST_SCHRITTARTEN} verschiedene Schrittarten nötig`);
  }

  return fehler;
}

export function startZustand(): ErmittlungsZustand {
  return {
    erledigt: {},
    belegeErkannt: [],
    einsatzrahmenVerletzt: false,
    sperreBis: null,
    sperreRestPruefungen: 0,
    vorwurfVersuche: 0,
    geloest: false,
  };
}

/** Ergänzt Felder, die ein älter gespeicherter Zustand nicht kennt. Gibt eine Kopie zurück. */
export function mitZustandsDefaults(
  z: Omit<ErmittlungsZustand, 'sperreRestPruefungen'> & { sperreRestPruefungen?: number }
): ErmittlungsZustand {
  const rest = z.sperreRestPruefungen;
  const sauber = typeof rest === 'number' && Number.isFinite(rest) && rest >= 0 ? rest : null;
  return {
    ...z,
    sperreRestPruefungen: sauber ?? (z.sperreBis !== null ? SPERRE_PRUEFUNGEN : 0),
  };
}

/** Der Schritt an der Stelle `erledigt[spur.id]`; alle erledigt ergibt null. */
export function aktuellerSchritt(spur: Spur, z: ErmittlungsZustand): ErmittlungsSchritt | null {
  const index = Object.hasOwn(z.erledigt, spur.id) ? (z.erledigt[spur.id] ?? 0) : 0;
  return spur.schritte[index] ?? null;
}

/** Prüfungen für den nächsten Prompt: je Spur der aktuelle Schritt, alle Belege, der Rahmen. */
export function offenePruefungen(e: Ermittlung, z: ErmittlungsZustand): Pruefung[] {
  if (z.geloest) return [];
  const pruefungen: Pruefung[] = [];
  for (const spur of e.spuren) {
    const schritt = aktuellerSchritt(spur, z);
    if (schritt) {
      pruefungen.push({ id: pruefIdSchritt(spur.id, schritt.id), skript: schritt.verify });
      if (schritt.diagnose) {
        pruefungen.push({
          id: pruefIdDiagnose(spur.id, schritt.id),
          skript: schritt.diagnose,
          diagnose: true,
        });
      }
    }
  }
  for (const beleg of e.vorwurf.belege) {
    pruefungen.push({ id: pruefIdBeleg(beleg.id), skript: beleg.verify });
  }
  if (!z.einsatzrahmenVerletzt) {
    pruefungen.push({ id: PRUEF_ID_VERSTOSS, skript: e.einsatzrahmen.verstoss });
  }
  return pruefungen;
}

/**
 * Ein Bash-Skript für einen einzigen RUN; jede Prüfung liefert eine Zeile mit ihrem Exit-Code.
 * Ein identisches Skript steht nur einmal im Bündel und läuft einmal; alle zugehörigen IDs
 * erhalten dessen Ergebnis. Die Reihenfolge der Zeilen bleibt die der Prüfungen.
 */
export function buendelSkript(pruefungen: readonly Pruefung[]): string {
  const anzahl = new Map<string, number>();
  const ergebnisse = pruefungen.filter((p) => !p.diagnose);
  for (const p of ergebnisse) anzahl.set(p.skript, (anzahl.get(p.skript) ?? 0) + 1);
  const ergebnisVar = new Map<string, string>();
  const teile: string[] = [];
  for (const p of pruefungen) {
    if (!/^[a-z0-9.-]{1,90}$/.test(p.id)) throw new Error(`Ungültige Prüf-ID: ${p.id}`);
    if (p.diagnose) {
      // Nur die erste Zeile, ohne Steuerzeichen und gekürzt, mit Bash-Builtins; Fehler bleiben stumm.
      teile.push(
        `dz=$( (\n${p.skript}\n) 2>/dev/null </dev/null | { IFS= read -r dz; printf %s "$dz"; } )\n` +
          `dz=\${dz//[[:cntrl:]]/}\n` +
          `printf 'diagnose\\t%s\\t%s\\n' '${p.id}' "\${dz:0:${DIAGNOSE_MAX_ZEICHEN}}"`
      );
      continue;
    }
    let ergebnis = '"$?"';
    let lauf = `(\n${p.skript}\n) >/dev/null 2>&1 </dev/null\n`;
    if ((anzahl.get(p.skript) ?? 0) > 1) {
      const bekannt = ergebnisVar.get(p.skript);
      const name = bekannt ?? `r${ergebnisVar.size}`;
      ergebnisVar.set(p.skript, name);
      ergebnis = `"$${name}"`;
      lauf = bekannt === undefined ? `${lauf}${name}=$?\n` : '';
    }
    teile.push(`${lauf}printf 'pruefung\\t%s\\t%s\\n' '${p.id}' ${ergebnis}`);
  }
  teile.push(`printf 'ende\\t%s\\n' '${ergebnisse.length}'`);
  return `${teile.join('\n')}\n`;
}

/**
 * Skript für die Prüfung einer Antwort: Die Antwort geht nur als Base64 in den Text und steht der
 * Prüfung (Subshell, stumm, Exit-Code wird durchgereicht) in $ANTWORT zur Verfügung.
 */
export function antwortSkript(pruefung: string, antwort: string): string {
  const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(antwort)));
  return `ANTWORT=$(printf %s '${base64}' | base64 -d)\nexport ANTWORT\n(\n${pruefung}\n) >/dev/null 2>&1 </dev/null\n`;
}

/** Meldung der Gast-Diagnose: ohne Steuerzeichen, auf höchstens DIAGNOSE_MAX_ZEICHEN gekürzt. */
const bereinigeDiagnose = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, DIAGNOSE_MAX_ZEICHEN);

/** Liest die Ausgabe eines Bündels; vollständig nur mit passender Schlusszahl. */
export function leseBuendelAusgabe(text: string): PruefungsAusgabe {
  const ergebnisse = Object.create(null) as Record<string, boolean>;
  const diagnosen = Object.create(null) as Record<string, string>;
  let gelesen = 0;
  let schluss: number | null = null;
  for (const roh of text.split('\n')) {
    const zeile = roh.endsWith('\r') ? roh.slice(0, -1) : roh;
    const teile = zeile.split('\t');
    if (teile.length === 3 && teile[0] === 'pruefung' && /^\d+$/.test(teile[2])) {
      ergebnisse[teile[1]] = teile[2] === '0';
      gelesen++;
    } else if (teile.length >= 3 && teile[0] === 'diagnose') {
      diagnosen[teile[1]] = bereinigeDiagnose(teile.slice(2).join('\t'));
    } else if (teile.length === 2 && teile[0] === 'ende' && /^\d+$/.test(teile[1])) {
      schluss = Number(teile[1]);
    }
  }
  const vollstaendig = schluss !== null && schluss === gelesen;
  return Object.keys(diagnosen).length
    ? { ergebnisse, diagnosen, vollstaendig }
    : { ergebnisse, vollstaendig };
}

/** Führt eine vollständige Ausgabe in den Zustand; unvollständige Ausgaben ändern nichts. */
export function wendePruefungAn(
  e: Ermittlung,
  z: ErmittlungsZustand,
  ausgabe: PruefungsAusgabe
): { zustand: ErmittlungsZustand; ereignisse: ErmittlungsEreignis[] } {
  if (z.geloest) return { zustand: z, ereignisse: [] };
  if (!ausgabe.vollstaendig) {
    return { zustand: z, ereignisse: [{ type: 'pruefung-unvollstaendig' }] };
  }

  const ereignisse: ErmittlungsEreignis[] = [];
  const erledigt: Record<string, number> = { ...z.erledigt };

  for (const spur of e.spuren) {
    const schritt = aktuellerSchritt(spur, z);
    if (!schritt || ausgabe.ergebnisse[pruefIdSchritt(spur.id, schritt.id)] !== true) continue;
    const neu = (Object.hasOwn(z.erledigt, spur.id) ? (z.erledigt[spur.id] ?? 0) : 0) + 1;
    erledigt[spur.id] = neu;
    ereignisse.push({ type: 'schritt-erledigt', spurId: spur.id, schrittId: schritt.id });
    if (neu >= spur.schritte.length) ereignisse.push({ type: 'spur-erledigt', spurId: spur.id });
  }

  const letzteDiagnose: Record<string, string> = { ...z.letzteDiagnose };
  for (const spur of e.spuren) {
    const schritt = aktuellerSchritt(spur, z);
    if (!schritt?.diagnose) continue;
    const key = `${spur.id}/${schritt.id}`;
    const verify = ausgabe.ergebnisse[pruefIdSchritt(spur.id, schritt.id)];
    const text = ausgabe.diagnosen?.[pruefIdDiagnose(spur.id, schritt.id)] ?? '';
    if (verify !== false || !text) {
      delete letzteDiagnose[key];
    } else if (letzteDiagnose[key] !== text) {
      letzteDiagnose[key] = text;
      ereignisse.push({ type: 'diagnose', spurId: spur.id, schrittId: schritt.id, text });
    }
  }

  const vorher = new Set(z.belegeErkannt);
  const erkannt: string[] = [];
  const neuErkannt: string[] = [];
  const verloren: string[] = [];
  for (const beleg of e.vorwurf.belege) {
    const key = pruefIdBeleg(beleg.id);
    const bisher = vorher.has(beleg.id);
    const jetzt = Object.hasOwn(ausgabe.ergebnisse, key)
      ? ausgabe.ergebnisse[key] === true
      : bisher;
    if (jetzt) {
      erkannt.push(beleg.id);
      if (!bisher) neuErkannt.push(beleg.id);
    } else if (bisher) {
      verloren.push(beleg.id);
    }
  }
  for (const belegId of neuErkannt) ereignisse.push({ type: 'beleg-erkannt', belegId });
  for (const belegId of verloren) ereignisse.push({ type: 'beleg-verloren', belegId });
  erkannt.sort();

  let sperreBis = z.sperreBis;
  let sperreRestPruefungen = z.sperreRestPruefungen;
  if (z.sperreBis !== null) {
    if (erkannt.length >= z.sperreBis) {
      sperreBis = null;
      sperreRestPruefungen = 0;
      ereignisse.push({ type: 'sperre-aufgehoben' });
    } else {
      sperreRestPruefungen = z.sperreRestPruefungen - 1;
      if (sperreRestPruefungen <= 0) {
        sperreBis = null;
        sperreRestPruefungen = 0;
        ereignisse.push({ type: 'sperre-aufgehoben' });
      }
    }
  }

  let einsatzrahmenVerletzt = z.einsatzrahmenVerletzt;
  if (!z.einsatzrahmenVerletzt && ausgabe.ergebnisse[PRUEF_ID_VERSTOSS] === true) {
    einsatzrahmenVerletzt = true;
    ereignisse.push({ type: 'einsatzrahmen-verletzt' });
    const naechste = naechsteSperre(e, { ...z, erledigt, belegeErkannt: erkannt, sperreBis });
    if (naechste === null) {
      sperreBis = null;
      sperreRestPruefungen = 0;
    } else {
      sperreBis = naechste;
      sperreRestPruefungen = SPERRE_PRUEFUNGEN;
    }
  }

  return {
    zustand: {
      erledigt,
      belegeErkannt: erkannt,
      einsatzrahmenVerletzt,
      sperreBis,
      sperreRestPruefungen,
      vorwurfVersuche: z.vorwurfVersuche,
      geloest: z.geloest,
      ...(Object.keys(letzteDiagnose).length ? { letzteDiagnose } : {}),
    },
    ereignisse,
  };
}

/** Eine richtige Antwort erledigt den aktuellen Schritt wie ein bestandenes verify; sonst nichts. */
export function wendeAntwortAn(
  e: Ermittlung,
  z: ErmittlungsZustand,
  spurId: string,
  schrittId: string,
  richtig: boolean
): { zustand: ErmittlungsZustand; ereignisse: ErmittlungsEreignis[] } {
  const unveraendert = { zustand: z, ereignisse: [] };
  if (!richtig || z.geloest) return unveraendert;
  const spur = e.spuren.find((eintrag) => eintrag.id === spurId);
  const schritt = spur ? aktuellerSchritt(spur, z) : null;
  if (!spur || !schritt || schritt.id !== schrittId) return unveraendert;
  const neu = (Object.hasOwn(z.erledigt, spur.id) ? (z.erledigt[spur.id] ?? 0) : 0) + 1;
  const ereignisse: ErmittlungsEreignis[] = [{ type: 'schritt-erledigt', spurId, schrittId }];
  if (neu >= spur.schritte.length) ereignisse.push({ type: 'spur-erledigt', spurId });
  return { zustand: { ...z, erledigt: { ...z.erledigt, [spur.id]: neu } }, ereignisse };
}

/** Sperre einen Beleg hinter den Stand; ohne weiteren Beleg bleibt sie aus (Sackgassen-Regel). */
export function naechsteSperre(e: Ermittlung, z: ErmittlungsZustand): number | null {
  if (e.vorwurf.ohneSperre) return null;
  const ziel = z.belegeErkannt.length + 1;
  if (ziel > e.vorwurf.belege.length) return null;
  return Math.max(ziel, z.sperreBis ?? 0);
}

export function istGesperrt(z: ErmittlungsZustand): boolean {
  return z.sperreBis !== null && z.belegeErkannt.length < z.sperreBis;
}

/** Bewertet einen Vorwurf; die Fälle der Spec-Tabelle in fester Reihenfolge. */
export function pruefeVorwurf(
  e: Ermittlung,
  z: ErmittlungsZustand,
  vorwurf: { verdaechtigeId: string; belegIds: readonly string[] }
): { zustand: ErmittlungsZustand; ergebnis: VorwurfErgebnis; antwort: readonly string[] } {
  const { antworten, taeterId, belege, mindestBelege, jedeSpur } = e.vorwurf;

  if (z.geloest) return { zustand: z, ergebnis: 'bereits-geloest', antwort: [] };

  if (istGesperrt(z)) return { zustand: z, ergebnis: 'gesperrt', antwort: antworten.gesperrt };

  const erkannt = new Set(z.belegeErkannt);
  if (vorwurf.belegIds.some((id) => !erkannt.has(id))) {
    return { zustand: z, ergebnis: 'beleg-unbekannt', antwort: [] };
  }

  if (vorwurf.verdaechtigeId !== taeterId) {
    const sperre = naechsteSperre(e, z);
    return {
      zustand: {
        ...z,
        vorwurfVersuche: z.vorwurfVersuche + 1,
        sperreBis: sperre,
        sperreRestPruefungen: sperre === null ? 0 : SPERRE_PRUEFUNGEN,
      },
      ergebnis: 'falsche-person',
      antwort: antworten.falschePerson,
    };
  }

  const genannt = new Set(vorwurf.belegIds);
  const gegenTaeter = belege.filter((b) => genannt.has(b.id) && b.stuetzt === taeterId);
  const spuren = new Set(gegenTaeter.map((b) => b.spurId));
  const spurenVollstaendig = e.spuren.every((s) => spuren.has(s.id));
  if (gegenTaeter.length < mindestBelege || (jedeSpur && !spurenVollstaendig)) {
    const sperre = naechsteSperre(e, z);
    return {
      zustand: {
        ...z,
        vorwurfVersuche: z.vorwurfVersuche + 1,
        sperreBis: sperre,
        sperreRestPruefungen: sperre === null ? 0 : SPERRE_PRUEFUNGEN,
      },
      ergebnis: 'zu-wenig-belege',
      antwort: antworten.zuWenigBelege,
    };
  }

  return {
    zustand: {
      ...z,
      vorwurfVersuche: z.vorwurfVersuche + 1,
      geloest: true,
      sperreBis: null,
      sperreRestPruefungen: 0,
    },
    ergebnis: 'richtig',
    antwort: antworten.richtig,
  };
}
