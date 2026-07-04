/**
 * Zentrale Datenquelle für /certifications.
 *
 * Neue Nachweise erscheinen auf der Seite, sobald hier ein Objekt ergänzt
 * wird — Komponenten enthalten keine hartcodierten Einträge.
 *
 * Architektur-Hinweis für spätere Integrationen (Credly API, LinkedIn,
 * Coursera, JSON-/Markdown-Import): externe Quellen werden als eigene
 * Loader implementiert, die nach `Certification` mappen und ihr Ergebnis
 * mit diesem Array zusammenführen. Das Interface bleibt dabei der
 * stabile Vertrag; die Seite konsumiert ausschließlich `certifications`.
 */

export interface Certification {
  id: string;
  title: string;
  issuer: string;
  /** ISO-Datum (YYYY-MM-DD). Fehlt bei Einträgen ohne öffentliches Datum. */
  issuedAt?: string;
  status: 'verified' | 'in-progress' | 'planned';
  description?: string;
  skills?: string[];
  verificationUrl?: string;
  featured?: boolean;
}

export const certifications: Certification[] = [
  {
    id: 'ccna-introduction-to-networks',
    title: 'CCNA: Introduction to Networks',
    issuer: 'Cisco Networking Academy',
    status: 'verified',
    description:
      'Erstes Modul des CCNA-Pfads: Netzwerkgrundlagen, OSI- und TCP/IP-Modell, IPv4-/IPv6-Adressierung, Ethernet-Switching und grundlegende Router-Konfiguration.',
    skills: ['Netzwerkgrundlagen', 'IPv4/IPv6', 'Switching', 'Cisco IOS'],
    verificationUrl:
      'https://www.credly.com/badges/32409c05-1c93-4703-895f-1d88e525f483/linked_in_profile',
    featured: true,
  },
  {
    id: 'google-systemverwaltung-it-infrastruktur',
    title: 'Systemverwaltung und IT-Infrastrukturdienste',
    issuer: 'Google · Coursera',
    issuedAt: '2026-04-07',
    status: 'verified',
    description:
      'Rund 30 Stunden Kursarbeit zu Serveradministration, Verzeichnisdiensten (LDAP), Cloud-Grundlagen, Datenverwaltung und Disaster Recovery.',
    skills: ['Systemverwaltung', 'LDAP', 'Cloud Computing', 'Disaster Recovery'],
    verificationUrl: 'https://www.coursera.org/account/accomplishments/verify/BEQDVNRAE2TZ',
    featured: true,
  },
  {
    id: 'windows-server-2025-administration',
    title: 'Windows Server 2025 Administration Grundkurs',
    issuer: 'LinkedIn Learning',
    issuedAt: '2026-06-28',
    status: 'verified',
    description:
      'Grundkurs zur Administration von Windows Server 2025: Rollen und Features, Verwaltungswerkzeuge und Basiskonfiguration im Serverbetrieb.',
    skills: ['Windows Server', 'Serveradministration'],
    verificationUrl:
      'https://www.linkedin.com/learning/certificates/70a2d1495aa1d74777b4fdae81395d8513e11abb63c3d54462fe5e31c24206f4',
  },
  {
    id: 'ihk-fachinformatiker-systemintegration',
    title: 'Ausbildung Fachinformatiker Systemintegration (IHK)',
    issuer: 'IHK',
    status: 'in-progress',
    description:
      'Laufende Berufsausbildung mit Schwerpunkt Systemintegration: Netzwerke, Serverbetrieb, IT-Sicherheit und Automatisierung — dokumentiert in Projekten und Blog.',
    skills: ['Systemintegration', 'Netzwerktechnik', 'IT-Sicherheit'],
  },
  {
    id: 'ccna-switching-routing-wireless',
    title: 'CCNA: Switching, Routing, and Wireless Essentials',
    issuer: 'Cisco Networking Academy',
    status: 'planned',
    description:
      'Zweites Modul des CCNA-Pfads: VLANs, Inter-VLAN-Routing, STP, EtherChannel und WLAN-Grundlagen.',
    skills: ['VLANs', 'Routing', 'STP', 'WLAN'],
  },
];

export const statusMeta: Record<Certification['status'], { label: string; rank: number }> = {
  verified: { label: 'Verifiziert', rank: 0 },
  'in-progress': { label: 'In Bearbeitung', rank: 1 },
  planned: { label: 'Geplant', rank: 2 },
};

/** Verifizierte zuerst (neueste oben), dann laufende, dann geplante. */
export function sortCertifications(entries: Certification[]): Certification[] {
  return [...entries].sort((a, b) => {
    const byStatus = statusMeta[a.status].rank - statusMeta[b.status].rank;
    if (byStatus !== 0) return byStatus;
    return (b.issuedAt ?? '').localeCompare(a.issuedAt ?? '');
  });
}
