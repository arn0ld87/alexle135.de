import React from 'react';
import { Server, Box, GitBranch, Bot } from 'lucide-react';
import { Card } from '../ds';
import { SectionHead } from './SectionHead';

const AREAS = [
  {
    Icon: Server,
    t: 'Linux & Server',
    d: 'Härtung, Netzwerk und Betrieb auf eigenem VPS — reproduzierbar dokumentiert.',
    href: '/kompetenzen/',
  },
  {
    Icon: Box,
    t: 'Container & DevOps',
    d: 'Docker, Compose und Traefik. CI/CD-Pipelines, die ohne Überraschungen deployen.',
    href: '/leistungen/',
  },
  {
    Icon: GitBranch,
    t: 'Automatisierung',
    d: 'Ansible-Rollen und Skripte — wiederkehrende Arbeit einmal sauber lösen.',
    href: '/blog/',
  },
  {
    Icon: Bot,
    t: 'KI & Tooling',
    d: 'Gemini-gestützte Werkzeuge und Agenten, praxisnah in echte Workflows gebracht.',
    href: '/ki-agenten-lab/',
  },
] as const;

export function FocusAreas() {
  return (
    <section id="portfolio" className="focus-section">
      <div className="ds-shell">
        <SectionHead
          kicker="// Schwerpunkte"
          title="Worauf ich mich konzentriere"
          id="home-focus-title"
        />
        <div className="focus-grid">
          {AREAS.map(({ Icon, t, d, href }) => (
            <Card key={t} as="a" href={href} interactive padding="lg" className="focus-card">
              <span className="focus-icon">
                <Icon size={22} strokeWidth={2} />
              </span>
              <h3 className="focus-title">{t}</h3>
              <p className="focus-desc">{d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FocusAreas;
