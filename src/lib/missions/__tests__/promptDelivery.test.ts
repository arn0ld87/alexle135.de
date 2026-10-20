import { describe, expect, it, vi } from 'vitest';
import { createPromptDelivery, HOME_RESET_INPUT, REDRAW_KEY } from '../promptDelivery';

// #392: Rückmeldungen der stillen Prüfung kommen asynchron. Steht die Shell am Prompt, wird die
// Zeile geleert, die Meldung geschrieben und Bash zeichnet Prompt und Eingabe neu. Läuft ein
// Befehl, wartet die Meldung bis zum nächsten Prompt.
function setup() {
  const write = vi.fn<(text: string) => void>();
  const sendKey = vi.fn<(key: string) => void>();
  const delivery = createPromptDelivery({ write, sendKey });
  return { delivery, write, sendKey };
}

describe('promptDelivery', () => {
  it('zeigt am Prompt sofort an und lässt Bash neu zeichnen', () => {
    const { delivery, write, sendKey } = setup();
    delivery.prompt();
    delivery.deliver('Schritt 1/5 erfüllt\nWeiter mit Schritt 2/5');
    expect(write).toHaveBeenCalledWith(
      '\r\x1b[2KSchritt 1/5 erfüllt\r\nWeiter mit Schritt 2/5\r\n'
    );
    expect(sendKey).toHaveBeenCalledWith(REDRAW_KEY);
  });

  it('hält Meldungen zurück, solange ein Befehl läuft, und zeigt sie am nächsten Prompt', () => {
    const { delivery, write, sendKey } = setup();
    delivery.prompt();
    delivery.input('nano notiz.txt\r');
    delivery.deliver('Fast.');
    expect(write).not.toHaveBeenCalled();
    delivery.prompt();
    expect(write).toHaveBeenCalledWith('\r\x1b[2KFast.\r\n');
    expect(sendKey).toHaveBeenCalledWith(REDRAW_KEY);
  });

  it('wartet bei vorgetipptem Befehl bis zum Prompt danach', () => {
    const { delivery, write } = setup();
    delivery.prompt();
    delivery.input('sleep 3\r');
    delivery.input('ls\r'); // vorgetippt, während sleep läuft
    delivery.deliver('Schritt erfüllt');
    delivery.prompt(true); // Prompt nach sleep, der Hook sieht das vorgetippte ls
    expect(write).not.toHaveBeenCalled();
    delivery.prompt(); // Prompt nach ls
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('bleibt nicht hängen, wenn ein Programm Enter ohne Prompt bekommt (nano)', () => {
    const { delivery, write } = setup();
    delivery.prompt();
    delivery.input('nano notiz.txt\r');
    delivery.input('Zeile 1\rZeile 2\r');
    delivery.deliver('Fast.');
    delivery.prompt();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('ignoriert leere Meldungen und Tippen ohne Enter', () => {
    const { delivery, write } = setup();
    delivery.prompt();
    delivery.input('ls -l');
    delivery.deliver('');
    expect(write).not.toHaveBeenCalled();
    delivery.deliver('ok');
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('vor dem ersten Prompt gilt die Shell als beschäftigt', () => {
    const { delivery, write } = setup();
    delivery.deliver('früh');
    expect(write).not.toHaveBeenCalled();
    delivery.prompt();
    expect(write).toHaveBeenCalledTimes(1);
  });

  // #426: Jeder Vorfallstart beginnt im Home mit leerem Terminal.
  describe('resetShell', () => {
    it('schickt am Prompt cd ~ samt Terminal-Reset und verwirft wartende Meldungen', () => {
      const { delivery, write, sendKey } = setup();
      delivery.prompt();
      expect(delivery.resetShell()).toBe(true);
      expect(sendKey).toHaveBeenCalledWith(HOME_RESET_INPUT);
      expect(HOME_RESET_INPUT).toBe("\x15 cd ~ && printf '\\033c'\r");
      // Bis der neue Prompt kommt, gilt die Shell als beschäftigt.
      delivery.deliver('Alt');
      expect(write).not.toHaveBeenCalled();
    });

    it('merkt den Reset bei laufendem Befehl vor und führt ihn am nächsten Prompt aus', () => {
      const { delivery, sendKey } = setup();
      delivery.prompt();
      delivery.input('mission next\r');
      expect(delivery.resetShell()).toBe(false);
      expect(sendKey).not.toHaveBeenCalled();
      delivery.prompt(true); // vorgetippter Befehl: noch kein Prompt
      expect(sendKey).not.toHaveBeenCalled();
      delivery.prompt();
      expect(sendKey).toHaveBeenCalledTimes(1);
      expect(sendKey).toHaveBeenCalledWith(HOME_RESET_INPUT);
      delivery.prompt(); // Prompt nach dem Reset: kein zweiter Reset
      expect(sendKey).toHaveBeenCalledTimes(1);
    });

    it('ignoriert Meldungen einer Prüfung, die vor dem Wechsel gestartet wurde', () => {
      const { delivery, write } = setup();
      delivery.prompt();
      const alt = delivery.generation();
      delivery.resetShell();
      delivery.prompt();
      delivery.deliver('Alt', alt);
      expect(write).not.toHaveBeenCalled();
      delivery.deliver('Neu', delivery.generation());
      expect(write).toHaveBeenCalledWith('\r\x1b[2KNeu\r\n');
    });

    it('verwirft Meldungen des alten Vorfalls auch ohne Prompt', () => {
      const { delivery, write } = setup();
      delivery.prompt();
      delivery.input('sleep 1\r');
      delivery.deliver('Alt');
      delivery.resetShell();
      delivery.prompt();
      expect(write).not.toHaveBeenCalled();
    });
  });
});
