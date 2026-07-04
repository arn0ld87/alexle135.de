const SITE_ORIGIN = 'https://alexle135.de';

const LABEL_MAP: Record<string, string> = {
  blog: 'Logbuch',
  projekte: 'Projekte',
  leistungen: 'Leistungen',
  'ueber-mich': 'Über mich',
  kontakt: 'Kontakt',
  legal: 'Rechtliches',
  impressum: 'Impressum',
  datenschutz: 'Datenschutz',
  apps: 'Apps',
  'ki-agenten-lab': 'KI Agenten Lab',
  certifications: 'Zertifikate',
};

function slugToLabel(slug: string): string {
  if (LABEL_MAP[slug]) return LABEL_MAP[slug];
  return slug
    .split('-')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function buildBreadcrumbSchema(pathname: string): object | null {
  const normalized = pathname.replace(/\/+$/, '');
  if (normalized === '' || normalized === '/') return null;

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Startseite',
      item: `${SITE_ORIGIN}/`,
    },
    ...segments.map((segment, index) => ({
      '@type': 'ListItem',
      position: index + 2,
      name: slugToLabel(segment),
      item: `${SITE_ORIGIN}/${segments.slice(0, index + 1).join('/')}/`,
    })),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}
