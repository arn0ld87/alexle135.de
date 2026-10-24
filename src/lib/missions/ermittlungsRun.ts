// S2-RUN-Warteschlange (Ticket 5): Ein Adapter je gemounteter ErmittlungApp serialisiert
// Setup-, Prüf- und Abfrage-RUNs. Der Agent-Timeout beginnt erst beim tatsächlichen Senden.
import type { AgentClient, AgentResult } from './agentClient';

export interface ErmittlungsRun {
  run(
    client: AgentClient,
    skript: string,
    timeoutMs: number,
    istAktuell: () => boolean
  ): Promise<AgentResult>;
}

type Auftrag = {
  client: AgentClient;
  skript: string;
  timeoutMs: number;
  istAktuell: () => boolean;
  resolve: (resultat: AgentResult) => void;
  reject: (fehler: Error) => void;
};

const VERAELTET = 'Der Ermittlungsauftrag ist nicht mehr aktuell.';

const istGueltig = (auftrag: Auftrag): boolean => {
  try {
    return auftrag.istAktuell();
  } catch {
    return false;
  }
};

export function erzeugeErmittlungsRun(): ErmittlungsRun {
  const warteschlange: Auftrag[] = [];
  let sendet = false;

  const pumpe = async (): Promise<void> => {
    if (sendet) return;
    sendet = true;
    try {
      for (;;) {
        const auftrag = warteschlange.shift();
        if (!auftrag) break;
        if (!istGueltig(auftrag)) {
          auftrag.reject(new Error(VERAELTET));
          continue;
        }
        let ergebnis: AgentResult;
        try {
          ergebnis = await auftrag.client.run(auftrag.skript, auftrag.timeoutMs);
        } catch (error) {
          auftrag.reject(error instanceof Error ? error : new Error(String(error)));
          continue;
        }
        if (istGueltig(auftrag)) auftrag.resolve(ergebnis);
        else auftrag.reject(new Error(VERAELTET));
      }
    } finally {
      sendet = false;
    }
  };

  return {
    run(client, skript, timeoutMs, istAktuell) {
      return new Promise<AgentResult>((resolve, reject) => {
        warteschlange.push({ client, skript, timeoutMs, istAktuell, resolve, reject });
        void pumpe();
      });
    },
  };
}
