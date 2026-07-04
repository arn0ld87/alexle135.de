/**
 * Serialisiert ein Objekt sicher fuer <script type="application/ld+json">.
 * Escaped <, >, & sowie U+2028/U+2029, damit kein </script>-Breakout oder
 * JS-String-Bruch moeglich ist (Issue #180, JSON-LD sicher serialisieren).
 */
export function safeJsonLd(data: unknown): string {
  // JSON.stringify gibt undefined zurueck, wenn data undefined ist oder eine
  // Funktion/Symbol \u2014 dann waere .replace ein TypeError (Gemini #184).
  const json = JSON.stringify(data);
  if (!json) return '';
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
