// Globale-Suche-E2E (Issue #296).
//
// HINWEIS: src/components/Search.astro (Fuse.js-Suchfeld) ist aktuell in
// keiner Seite eingebunden — der einzige Treffer für "Search" in
// src/components/ds/Showcase.tsx ist das lucide-react-Icon, nicht das
// Astro-Suchfeld (verifiziert per Grep über src/pages, src/layouts,
// src/components vor dem Schreiben dieses Tests). Es gibt daher keine
// erreichbare Such-UI, gegen die man im Browser klicken könnte. Getestet wird
// deshalb der tatsächlich produktiv ausgelieferte Vertrag: der
// /api/search.json-Endpunkt (src/pages/api/search.json.ts), den die
// Such-Komponente konsumieren WÜRDE, sobald sie eingebunden wird.
import { expect, test } from '@playwright/test';

interface SearchIndexEntry {
  title: string;
  slug: string;
  url: string;
  type: 'blog' | 'project' | 'service';
  tags: string[];
}

test.describe('Globale Suche (/api/search.json)', () => {
  test('liefert einen durchsuchbaren Index aus Blog-, Projekt- und Service-Einträgen', async ({
    request,
  }) => {
    const response = await request.get('/api/search.json');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');

    const index = (await response.json()) as SearchIndexEntry[];
    expect(Array.isArray(index)).toBe(true);
    expect(index.length).toBeGreaterThan(0);

    for (const entry of index) {
      expect(typeof entry.title).toBe('string');
      expect(entry.title.length).toBeGreaterThan(0);
      expect(typeof entry.url).toBe('string');
      expect(['blog', 'project', 'service']).toContain(entry.type);
    }

    // Mindestens ein Blog- und ein Projekt-Eintrag sollten vorhanden sein —
    // ansonsten wäre der Content-Collection-Import stillschweigend leer.
    expect(index.some((entry) => entry.type === 'blog')).toBe(true);
    expect(index.some((entry) => entry.type === 'project')).toBe(true);
  });
});
