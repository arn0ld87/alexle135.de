// Zustellung asynchroner Rückmeldungen der stillen Prüfung ins Terminal (#392). Der Prompt-Hook
// wartet nicht mehr auf die Engine; ihre Meldung kommt später. Steht die Shell am Prompt, wird
// die Zeile geleert, die Meldung geschrieben und Bash zeichnet Prompt und Eingabe per
// Tastenbindung neu (REDRAW_KEY, siehe .bashrc). Läuft ein Befehl, wartet sie bis zum nächsten
// Prompt, damit nichts in die Eingabe eines laufenden Programms gerät. Kein DOM, testbar.

/** F12; in der .bashrc des Azubis an `redraw-current-line` gebunden. */
export const REDRAW_KEY = '\x1b[24~';

interface DeliveryOptions {
  /** Text ins Terminal schreiben (xterm). */
  write: (text: string) => void;
  /** Tasten an die Shell senden (serielle Schnittstelle). */
  sendKey: (key: string) => void;
}

/**
 * Neuer Vorfall (#426): Zeile verwerfen (Strg-U), ins Home wechseln und per eingebautem printf
 * das Terminal zurücksetzen (ESC c: leert auch den Rückblick). Die Shell zeichnet danach den
 * Prompt `azubi@alex-schneider:~$`. Das Image setzt kein HISTCONTROL; der Befehl löscht deshalb
 * zuerst seinen eigenen History-Eintrag (#428). Ohne führendes Leerzeichen, damit er auch mit
 * `ignorespace` in der History steht und `history -d -1` nie einen Befehl der Person trifft.
 */
export const HOME_RESET_INPUT = "\x15history -d -1; cd ~ && printf '\\033c'\r";

export function createPromptDelivery({ write, sendKey }: DeliveryOptions) {
  // Erst ab dem ersten Prompt gilt die Shell als bereit.
  let atPrompt = false;
  const pending: string[] = [];
  // Zählt Vorfallwechsel; Meldungen einer früheren Generation verfallen. Ein Wechsel mitten in
  // einem Befehl (`mission next`) merkt den Reset für den nächsten Prompt vor.
  let generation = 0;
  let resetPending = false;

  function show(text: string) {
    write(`\r\x1b[2K${text.replace(/\r?\n/g, '\r\n')}\r\n`);
    sendKey(REDRAW_KEY);
  }

  function sendHome() {
    atPrompt = false;
    sendKey(HOME_RESET_INPUT);
  }

  function flush() {
    while (atPrompt && pending.length > 0) show(pending.shift()!);
  }

  return {
    /**
     * Der Prompt-Hook hat sich gemeldet. `typeahead`: In der Eingabe wartet schon ein
     * vorgetippter Befehl (der Hook prüft das mit `read -t 0`); Bash startet ihn sofort, die
     * Shell steht dann nicht am Prompt.
     */
    prompt(typeahead = false) {
      atPrompt = !typeahead;
      if (atPrompt && resetPending) {
        resetPending = false;
        sendHome();
        return;
      }
      flush();
    },
    /** Eingabe der Person; Enter startet einen Befehl (oder bestätigt etwas in einem Programm). */
    input(data: string) {
      if (/[\r\n]/.test(data)) atPrompt = false;
    },
    /**
     * Beginnt ein anderer Vorfall: wartende Meldungen verfallen; steht die Shell am Prompt, geht
     * sie ins Home und das Terminal wird geleert. Läuft ein Befehl, wird der Reset für den nächsten
     * Prompt vorgemerkt (nichts landet in der Eingabe eines laufenden Programms). Gibt zurück, ob
     * sofort zurückgesetzt wurde.
     */
    resetShell() {
      generation++;
      pending.length = 0;
      if (!atPrompt) {
        resetPending = true;
        return false;
      }
      sendHome();
      return true;
    },
    /** Aktuelle Generation; vor dem Start einer Prüfung merken und an `deliver` übergeben. */
    generation: () => generation,
    deliver(text: string, fromGeneration = generation) {
      if (!text || fromGeneration !== generation) return;
      pending.push(text);
      flush();
    },
  };
}

export type PromptDelivery = ReturnType<typeof createPromptDelivery>;
