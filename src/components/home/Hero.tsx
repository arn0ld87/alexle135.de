import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Badge, Avatar, Card } from '../ds';

/** Editorial hero: statement + reticle-framed portrait + mini-terminal card. */
export interface HeroProps {
  portraitSrc?: string;
}

export function Hero({ portraitSrc = '/media/alex-portrait.webp' }: HeroProps) {
  return (
    <section className="hero-section">
      <div className="ds-dotgrid hero-dotgrid" />
      <div className="ds-shell hero-grid">
        <div>
          <div className="ds-kicker hero-kicker">// Systemintegration · DevOps · KI</div>
          <h1 className="ds-serif hero-title">
            Infrastruktur,
            <br />
            <em className="hero-em">klar</em> gedacht.
          </h1>
          <p className="hero-lead">
            Praxiswissen zu Linux, Containern und Automatisierung — dokumentiert, gezeigt und im
            Browser direkt ausprobierbar. Kein Lab nötig.
          </p>
          <div className="hero-actions">
            <Button
              href="/projekte/"
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={18} />}
            >
              Projekte ansehen
            </Button>
            <Button href="/ueber-mich/" variant="terminal" size="lg">
              ./about.sh
            </Button>
          </div>
          <div className="hero-badges">
            <Badge dot tone="success">
              VPS · Online
            </Badge>
            <Badge>Astro 6 SSR</Badge>
            <Badge>Node 22</Badge>
            <Badge>Docker · Traefik</Badge>
          </div>
        </div>

        <div className="hero-visual">
          <div className="ds-reticle hero-reticle" data-accent>
            <div className="hero-portrait-frame">
              <img
                src={portraitSrc}
                alt="Alexander Schneider"
                width={720}
                height={480}
                loading="eager"
                fetchPriority="high"
                className="hero-portrait"
              />
              <div className="hero-portrait-overlay" />
              <div className="hero-caption">
                <Avatar initials="AS" size="sm" status="online" />
                <div className="hero-caption-text">
                  <div className="hero-caption-name">Alexander Schneider</div>
                  <div className="hero-caption-role">Fachinformatik · Systemintegration</div>
                </div>
              </div>
            </div>
          </div>
          <Card variant="solid" padding="sm" className="hero-term">
            <div className="hero-term-line">
              <div>
                <span className="hero-term-user">alex@vps</span>
                <span className="hero-term-sep">:~$</span> uptime
              </div>
              <div className="hero-term-out">up 214 days · load 0.08</div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

export default Hero;
