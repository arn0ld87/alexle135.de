'use client';
import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  Copy,
  Github,
  Layers,
  Mail,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  IconButton,
  Input,
  Mark,
  Select,
  Switch,
  Tag,
  Tabs,
  Wordmark,
} from './';

/* ── shared micro-helpers ─────────────────────────────────────── */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '3rem' }}>
      <p className="ds-kicker" style={{ marginBottom: '1.25rem' }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: '0.75rem',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 'var(--text-h3)',
        color: 'var(--ink)',
        marginBottom: '2rem',
        marginTop: '0',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {children}
    </h3>
  );
}

/* ══ Showcase ═════════════════════════════════════════════════════ */
export function Showcase() {
  const [switchOn, setSwitchOn] = useState(false);
  const [checked, setChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('komponenten');

  const tabItems = [
    { value: 'komponenten', label: 'Komponenten', count: 14 },
    { value: 'tokens', label: 'Tokens', count: 6 },
    { value: 'muster', label: 'Muster' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* ── Buttons ──────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Buttons</SectionTitle>

        <Group label="// Varianten">
          <Row wrap>
            <Button variant="primary">Primär</Button>
            <Button variant="secondary">Sekundär</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="terminal">Terminal</Button>
            <Button variant="danger">Gefahr</Button>
          </Row>
        </Group>

        <Group label="// Grössen">
          <Row>
            <Button variant="primary" size="sm">
              Klein
            </Button>
            <Button variant="primary" size="md">
              Mittel
            </Button>
            <Button variant="primary" size="lg">
              Groß
            </Button>
          </Row>
        </Group>

        <Group label="// Zustände">
          <Row>
            <Button variant="primary" loading>
              Laden …
            </Button>
            <Button variant="secondary" iconRight={<ArrowRight size={18} />}>
              Weiter
            </Button>
            <Button variant="ghost" disabled>
              Deaktiviert
            </Button>
          </Row>
        </Group>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── IconButton ───────────────────────────────────────────── */}
      <section>
        <SectionTitle>IconButton</SectionTitle>
        <Group label="// Ghost / Solid / Akzent">
          <Row>
            <IconButton variant="ghost" label="Einstellungen">
              <Settings size={18} />
            </IconButton>
            <IconButton variant="solid" label="Benachrichtigung">
              <Bell size={18} />
            </IconButton>
            <IconButton variant="accent" label="Löschen">
              <Trash2 size={18} />
            </IconButton>
            <IconButton variant="ghost" size="sm" label="Kopieren">
              <Copy size={16} />
            </IconButton>
            <IconButton variant="ghost" size="lg" label="Github">
              <Github size={20} />
            </IconButton>
          </Row>
        </Group>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Badge ────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Badge</SectionTitle>
        <Group label="// Alle Töne">
          <Row wrap>
            <Badge tone="neutral">neutral</Badge>
            <Badge tone="accent">akzent</Badge>
            <Badge tone="success">erfolg</Badge>
            <Badge tone="warn">warnung</Badge>
            <Badge tone="danger">gefahr</Badge>
            <Badge tone="info">info</Badge>
            <Badge tone="success" dot>
              mit Punkt
            </Badge>
            <Badge tone="neutral" soft>
              soft
            </Badge>
          </Row>
        </Group>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Tag ──────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Tag</SectionTitle>
        <Group label="// Varianten">
          <Row wrap>
            <Tag>Einfach</Tag>
            <Tag icon={<Layers size={13} />}>Mit Icon</Tag>
            <Tag selected>Ausgewählt</Tag>
            <Tag onRemove={() => {}}>Entfernbar</Tag>
          </Row>
        </Group>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Avatar ───────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Avatar</SectionTitle>

        <Group label="// Initialen + Status">
          <Row>
            <Avatar initials="AS" size="sm" />
            <Avatar initials="AS" size="md" />
            <Avatar initials="AS" size="lg" />
            <Avatar initials="AS" size="xl" />
            <Avatar initials="AS" size="md" shape="round" />
            <Avatar initials="AS" size="md" status="online" />
            <Avatar initials="AS" size="md" status="offline" />
          </Row>
        </Group>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Card ─────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Card</SectionTitle>
        <Group label="// Varianten">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
              gap: '1rem',
            }}
          >
            <Card variant="default" padding="md">
              <p className="ds-kicker" style={{ marginBottom: '0.5rem' }}>
                Default
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--ds-text-sm)', margin: 0 }}>
                Glas-Oberfläche mit Blur
              </p>
            </Card>
            <Card variant="solid" padding="md">
              <p className="ds-kicker" style={{ marginBottom: '0.5rem' }}>
                Solid
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--ds-text-sm)', margin: 0 }}>
                Opakes Dunkel-Surface
              </p>
            </Card>
            <Card variant="raised" padding="md">
              <p className="ds-kicker" style={{ marginBottom: '0.5rem' }}>
                Raised
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--ds-text-sm)', margin: 0 }}>
                Erhöhte Ebene
              </p>
            </Card>
            <Card variant="default" padding="md" interactive>
              <p className="ds-kicker" style={{ marginBottom: '0.5rem' }}>
                Interaktiv
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--ds-text-sm)', margin: 0 }}>
                Hover-Lift und Cursor
              </p>
            </Card>
            <Card variant="default" padding="md" reticle>
              <p className="ds-kicker" style={{ marginBottom: '0.5rem' }}>
                Reticle
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--ds-text-sm)', margin: 0 }}>
                Eck-Brackets via CSS
              </p>
            </Card>
          </div>
        </Group>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Forms ────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Formularelemente</SectionTitle>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          <Input label="Suche" placeholder="Stichwort eingeben …" icon={<Search size={15} />} />
          <Input
            label="E-Mail-Adresse"
            type="email"
            placeholder="name@domain.de"
            invalid
            hint="Ungültige E-Mail-Adresse"
            icon={<Mail size={15} />}
          />
          <Select
            label="Framework"
            placeholder="Bitte wählen …"
            options={[
              { value: 'astro', label: 'Astro 6' },
              { value: 'react', label: 'React 19' },
              { value: 'vue', label: 'Vue 3' },
            ]}
          />
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Switch
            label="Benachrichtigungen aktivieren"
            checked={switchOn}
            onChange={(e) => setSwitchOn(e.target.checked)}
          />
          <Checkbox
            label="Nutzungsbedingungen akzeptieren"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
        </div>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Tabs</SectionTitle>
        <Group label="// Gesteuert mit useState">
          <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />
          <p
            style={{
              marginTop: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--ds-text-xs)',
              color: 'var(--muted)',
            }}
          >
            Aktiv: {activeTab}
          </p>
        </Group>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Callout ──────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Callout</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Callout tone="neutral" title="Hinweis">
            Neutrale Information ohne Priorität.
          </Callout>
          <Callout tone="accent" title="Tipp">
            Empfehlung mit Akzent-Hervorhebung.
          </Callout>
          <Callout tone="success" title="Erfolgreich">
            Aktion wurde abgeschlossen.
          </Callout>
          <Callout tone="warn" title="Achtung">
            Bitte vor dem Fortfahren prüfen.
          </Callout>
          <Callout tone="danger" title="Fehler">
            Kritischer Zustand — sofortiger Handlungsbedarf.
          </Callout>
        </div>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Mark + Wordmark ──────────────────────────────────────── */}
      <section>
        <SectionTitle>Mark &amp; Wordmark</SectionTitle>
        <Group label="// Brand-Symbol in verschiedenen Grössen">
          <Row>
            <Mark size={24} style={{ color: 'var(--ink)' }} />
            <Mark size={34} style={{ color: 'var(--ink)' }} />
            <Mark size={48} style={{ color: 'var(--ink)' }} />
          </Row>
        </Group>
        <Group label="// Wortmarke">
          <Wordmark size={19} />
        </Group>
      </section>

      <div className="ds-rule" style={{ margin: '0.5rem 0 2.5rem' }} />

      {/* ── Reticle + Rule ───────────────────────────────────────── */}
      <section>
        <SectionTitle>Reticle &amp; Rule</SectionTitle>
        <Group label="// ds-reticle — Eck-Brackets-Motiv">
          <div
            className="ds-reticle"
            data-accent
            style={{
              padding: '2rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '16rem',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--ds-text-xs)',
                color: 'var(--muted)',
                letterSpacing: 'var(--ds-tracking-label)',
                textTransform: 'uppercase',
              }}
            >
              Fokus-Element
            </span>
          </div>
        </Group>
        <Group label="// ds-rule — Haarlinie">
          <div className="ds-rule" />
        </Group>
      </section>
    </div>
  );
}

export default Showcase;
