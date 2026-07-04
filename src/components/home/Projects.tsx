import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Card, Tabs, Badge } from '../ds';
import type { BadgeTone } from '../ds';
import { SectionHead } from './SectionHead';

export interface ProjectEntry {
  title: string;
  cat: string;
  status: [BadgeTone, string];
  desc: string;
  stack: string[];
  href: string;
}

export interface ProjectsProps {
  projects: ProjectEntry[];
  filters?: string[];
}

export function Projects({
  projects,
  filters = ['Alle', 'Infrastruktur', 'KI', 'Web'],
}: ProjectsProps) {
  const [filter, setFilter] = React.useState('Alle');
  const shown = projects.filter((p) => filter === 'Alle' || p.cat === filter);

  return (
    <section id="projekte" className="projects-section">
      <div className="ds-shell">
        <SectionHead kicker="// Ausgewählte Arbeit" title="Projekte" id="home-projects-title">
          <Tabs value={filter} onChange={setFilter} items={filters} />
        </SectionHead>
        <div className="project-grid">
          {shown.map((p) => (
            <Card
              key={p.title}
              as="a"
              href={p.href}
              interactive
              padding="lg"
              className="project-card"
            >
              <div className="project-card-head">
                <Badge dot tone={p.status[0]}>
                  {p.status[1]}
                </Badge>
                <span className="proj-arrow">
                  <ArrowUpRight size={18} />
                </span>
              </div>
              <h3 className="ds-serif project-title">{p.title}</h3>
              <p className="project-desc">{p.desc}</p>
              <div className="project-stack">
                {p.stack.map((s) => (
                  <span key={s} className="project-tag">
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Projects;
