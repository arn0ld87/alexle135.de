/**
 * Versionskennung der OG-Bild-Adressen (Plan 02-15, D-47).
 *
 * Die OG-Routen sind ein Jahr als `immutable` gecacht, das Standard-Banner liegt unter
 * einem stabilen Pfad in Social-Caches. Eine geänderte Darstellung erreicht geteilte
 * Links nur über eine neue Adresse: V2Layout hängt diesen Wert als Parameter `v` an.
 *
 * Bei jeder sichtbaren Änderung am Renderer (`src/lib/og.ts`) oder am Standard-Banner
 * wird der Wert erhöht (sw1 → sw2 → …).
 */
export const OG_IMAGE_VERSION = 'sw1';
