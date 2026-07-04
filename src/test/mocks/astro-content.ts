// Stub für astro:content im Vitest-Kontext.
// Tests überschreiben getCollection per vi.mock('astro:content', factory).
export const getCollection = async () => [];
export const getEntry = async () => undefined;
// Content-Layer-API (Astro 6): render() wird als freie Funktion statt
// entry.render()-Methode importiert.
export const render = async () => ({ Content: () => null, headings: [] });
