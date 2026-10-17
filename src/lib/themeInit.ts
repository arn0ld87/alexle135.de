/**
 * Variantenwahl Papier / Bauplan (Systemwerk, D-07, D-38, D-39).
 *
 * `THEME_INIT_SCRIPT` ist die einzige Inline-Ausnahme von „alle Skripte
 * gebündelt“ (D-39): Ein gebündeltes Modulskript läuft erst nach dem ersten
 * Paint und könnte das Aufblitzen der falschen Variante nicht verhindern. Das
 * Skript steht per `set:html` im `head` von `V2Layout.astro`, vor dem
 * öffnenden `body`-Tag.
 *
 * CSP: Die Default-CSP erlaubt Inline-Skripte heute (`script-src` mit
 * `'unsafe-inline'`), es ist keine Header-Änderung nötig. Entfernt Phase 4
 * (SEC-08) `'unsafe-inline'`, braucht dieses Skript einen Hash oder eine
 * Nonce; `THEME_INIT_SHA256` hält den Hash dafür fest (CSP-Quelle
 * `'sha256-<THEME_INIT_SHA256>'`) und ein Test rechnet ihn nach.
 *
 * Das Skript ist eine statische Konstante ohne Eingaben aus Request,
 * Collection oder Umgebung, in ES5-Syntax und liest nur den gespeicherten Wert
 * unter `systemwerk-variant`. Nur der Wert `bauplan` schaltet um, jeder andere
 * Wert, ein leerer oder ein blockierter Speicher ergibt Papier. Es liest die
 * Farbschema-Präferenz des Systems nicht, setzt keine Cookies und sendet nichts
 * (D-38).
 *
 * Unter dem `ClientRouter` ersetzt der Seitenwechsel alle Attribute des
 * `html`-Elements. Deshalb wendet das Skript die Variante zusätzlich bei
 * `astro:before-swap` auf das `html`-Element des neuen Dokuments an.
 */

export const VARIANT_STORAGE_KEY = 'systemwerk-variant';

export const VARIANTS = ['papier', 'bauplan'] as const;

export type Variant = (typeof VARIANTS)[number];

/** Farbe für `meta[name=theme-color]` je Variante (gleich `--paper`). */
export const THEME_COLORS: Record<Variant, string> = {
  papier: '#eeeee6',
  bauplan: '#123b66',
};

/** Allowlist: nur `bauplan` ergibt `bauplan`, alles andere `papier`. */
export function parseVariant(value: unknown): Variant {
  return value === 'bauplan' ? 'bauplan' : 'papier';
}

export const THEME_INIT_SCRIPT =
  "(function(){var K='systemwerk-variant',B='#123b66',P='#eeeee6';" +
  'function s(d){var v=null,b,r=d.documentElement,m;' +
  'try{v=localStorage.getItem(K)}catch(e){}' +
  "b=v==='bauplan';" +
  "if(b)r.setAttribute('data-variant','bauplan');else r.removeAttribute('data-variant');" +
  'm=d.querySelector(\'meta[name="theme-color"]\');' +
  "if(m)m.setAttribute('content',b?B:P)}" +
  's(document);' +
  "document.addEventListener('astro:before-swap',function(e){s(e.newDocument)})" +
  '})();';

/** SHA-256 (Base64) von `THEME_INIT_SCRIPT`, für eine künftige CSP (SEC-08). */
export const THEME_INIT_SHA256 = 'D86ogCTAakhNgxeFf8FR+GnPrfpd7PeuLLLp7RJsjns=';
