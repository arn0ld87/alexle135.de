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

export function createPromptDelivery({ write, sendKey }: DeliveryOptions) {
  // Erst ab dem ersten Prompt gilt die Shell als bereit.
  let atPrompt = false;
  const pending: string[] = [];

  function show(text: string) {
    write(`\r\x1b[2K${text.replace(/\r?\n/g, '\r\n')}\r\n`);
    sendKey(REDRAW_KEY);
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
      flush();
    },
    /** Eingabe der Person; Enter startet einen Befehl (oder bestätigt etwas in einem Programm). */
    input(data: string) {
      if (/[\r\n]/.test(data)) atPrompt = false;
    },
    deliver(text: string) {
      if (!text) return;
      pending.push(text);
      flush();
    },
  };
}

export type PromptDelivery = ReturnType<typeof createPromptDelivery>;
