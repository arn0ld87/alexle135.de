---
title: 'Eigene Claude-Code-Skills bauen: SKILL.md, Bundling und warum mein Agent jetzt deutsch schreibt wie ich'
summary: 'Skills sind keine Tricks, sondern strukturierte Verhaltensregeln für den Agenten. Ich zeige dir am Beispiel eines Writing-Style-Skills, wie du SKILL.md, Bundling und Plugin-Namespacing aufbaust — und wo die Stolpersteine liegen.'
publishedAt: 2026-05-25
tags:
  - Claude Code
  - Skills
  - SKILL.md
  - Plugins
  - Agent Engineering
heroImage: /images/blog/eigene-claude-code-skills-bauen-bundling.webp
author: Alexander Schneider
---

Mein Agent schrieb bis vor sechs Wochen Marketingblödsinn. "Spannende Frage", "Lass uns die Möglichkeiten erkunden", "Hoffe, das hilft!". Ich konnte das im System-Prompt mit "schreib direkter" anstoßen, und nach dreißig Minuten war der Pump wieder weg. Compaction kostet System-Prompts den Kopf wie alles andere.

Skills lösen das. Sie sind keine Tricks, sondern Verhaltensregeln, die der Agent bei Bedarf lädt und sonst ignoriert. Bei mir sind es inzwischen elf eigene: vom Schreibstil bis zur Server-Backup-Routine, alles was sonst alle zwei Sessions wieder vergessen würde.

## Was ein Skill technisch ist

Ein Skill ist ein Ordner mit einer `SKILL.md`-Datei und optional zusätzlichen Files (Scripts, Referenzen, Beispiele). Die `SKILL.md` hat YAML-Frontmatter und Markdown-Body:

```markdown
---
name: alex-writing-identity
description: Schreibt deutsche Texte in Alex' Stil. Nutze bei Blog-Posts, Dokumentation, Agent-Persona-Antworten.
---

# Alex Writing Identity

Direkt, knapp, konkret. Keine Marketingfloskeln.

## Reihenfolge bei Konflikten

1. Sicherheitsregeln
2. Faktische Korrektheit
3. Nutzeranforderung
4. Stil

## Modus wählen

- `blog`: Artikel, Posts, alexle135.de
- `dokumentation`: README, How-to
- `agent`: Persona-Antworten
```

Das ist die kürzeste vollständige Form. Der Agent liest die `description` beim Session-Start, entscheidet bei einem Nutzerprompt, ob der Skill passt, und lädt erst dann den Body.

Genau dieser Lazy-Load ist der Punkt. Würde ich denselben Text in `CLAUDE.md` packen, wäre er **immer** im Kontext und würde **jede** Session Tokens kosten. Als Skill liegt er auf Disk, kostet nichts, und wird nur geladen, wenn er gebraucht wird.

## Wo Skills liegen

Vier Ebenen, mit klarer Vererbung:

| Ebene      | Pfad                               | Wirkung                 |
| ---------- | ---------------------------------- | ----------------------- |
| Enterprise | Managed Settings                   | Alle User der Org       |
| Persönlich | `~/.claude/skills/<name>/SKILL.md` | Alle deine Projekte     |
| Projekt    | `.claude/skills/<name>/SKILL.md`   | Nur dieses Repo         |
| Plugin     | `<plugin>/skills/<name>/SKILL.md`  | Wo das Plugin aktiv ist |

Bei mir liegen Writing-Style und Bewerbungs-Skills unter `~/.claude/skills/`. Projektgebundene Sachen wie "wie wird im Repo X commitet" liegen unter `.claude/skills/` im jeweiligen Repo. Soll ein Skill an mehrere Leute, kommt er ins Plugin.

Bei gleichem Namen schlägt Enterprise → Personal → Project. Plugin-Skills haben einen eigenen Namespace (`plugin-name:skill-name`), kollidieren also nicht.

## Mein Beispiel: `alex-writing-identity`

Echtes Beispiel aus meinem Setup. Ohne diesen Skill schreibt mein Agent Blog-Posts wie ein freundlicher Marketing-Praktikant. Mit ihm schreibt er wie ich.

### Aufbau

```
~/.claude/skills/alex-writing-identity/
├── SKILL.md
├── references/
│   ├── negativliste.md      # Floskeln, die nie auftauchen sollen
│   ├── ai_tells.md          # typische KI-Anzeichen
│   ├── modi.md              # Modus-Details
│   ├── stilbeispiele_blog.md
│   └── stilbeispiele_chat.md
└── scripts/
    └── alex_check.py        # Validator-Skript
```

Die **`SKILL.md`** ist die Eintrittstür. Sie ist absichtlich knapp — sie sagt dem Agenten, was er beachten muss und wann er welche Referenz lesen soll. Die Tiefe lebt in `references/`.

Das **`scripts/alex_check.py`** ist ein Validator, den der Agent vor finaler Ausgabe optional laufen lassen kann. Er prüft auf Floskeln, Em-Dash-Überdosis, generische Adjektive. Wenn ich konsequent wäre, würde ich das im Pre-Commit-Hook der Homepage haben — aktuell ist es ein Soft-Check.

### Was im Frontmatter steht

```yaml
---
name: alex-writing-identity
description: |
  Schreibt oder überarbeitet deutsche Texte in Alex' Stil.
  Nutze bei Blog, Dokumentation, Vortrag, Bewerbungen,
  Agent-Persona-Antworten und privatem Chat.
  Nicht nutzen für Faktenextraktion, Klassifikation, Logs.
---
```

Die **`description` ist das wichtigste Feld**, weil sie über Aufruf oder Nicht-Aufruf entscheidet. Lies sie als ein kleiner Klassifikator-Prompt: Was beschreibt der Skill? In welchen Situationen? Wann **nicht**? Je präziser, desto seltener Fehl-Aufrufe.

Drei Fehler, die ich gemacht habe und du nicht musst:

1. **Description zu generisch.** Erste Version: "Hilft beim Schreiben". Der Agent zog den Skill bei jeder Frage. Inzwischen sage ich explizit, wann _nicht_. Das halbiert die Fehl-Triggers.
2. **Body zu lang.** Erste Version: 8.000 Tokens Stilanleitung im Body. Der Agent las ihn vollständig, was in jeder Aktivierung teuer war. Refactor: 800 Tokens Eintrittstür, der Rest in `references/`, die der Agent nur bei Bedarf liest.
3. **Keine Modi.** Erste Version: Ein Stil für alles. Funktionierte nicht, weil mein Blog-Ton ein anderer ist als mein Chat mit Marc. Inzwischen sechs Modi, jeder mit eigenen Regeln und Beispielen.

## Erweiterte Felder

Im Frontmatter geht mehr als `name` und `description`. Die Felder, die ich tatsächlich nutze:

```yaml
---
name: deploy-alexle135
description: Deploy alexle135.de aus dem feature-homepage-redesign Branch
disable-model-invocation: true # Nur manuell via /deploy-alexle135
allowed-tools:
  - Bash(ssh:*)
  - Bash(rsync:*)
context: fork # Läuft in Subagent, frischer Kontext
---
```

Was die Felder tun:

- **`disable-model-invocation: true`** — Der Agent ruft den Skill nie automatisch auf. Du musst ihn explizit mit `/deploy-alexle135` triggern. Wichtig bei allem, was Dinge nach außen schickt: Deploy, E-Mails, Git-Push.
- **`allowed-tools`** — Whitelist für Werkzeuge, die der Skill ohne Per-Use-Approval nutzen darf. Spart Promptklicks bei wiederkehrenden Operationen.
- **`context: fork`** — Skill läuft in einem Subagent mit frischem Kontext. Sinnvoll, wenn der Skill viel Discovery macht, deren Output deinen Hauptkontext nicht belasten soll.

## Dynamic Context Injection

Eines der Features, das man oft übersieht: Du kannst in der `SKILL.md` Shell-Befehle ausführen lassen, deren Output im Moment des Aufrufs eingesetzt wird.

```markdown
---
name: summarize-changes
description: Fasst die aktuellen Git-Änderungen zusammen
---

Aktueller Diff:
!`git diff HEAD`

Aufgabe: Erstelle eine knappe Zusammenfassung der Änderungen,
gegliedert nach Datei und betroffener Funktion.
Markiere Risiken.
```

Die Backtick-Ausführung `` !`git diff HEAD` `` läuft, bevor der Skill an den Agenten geht. Der Agent sieht den Diff schon inline statt erst danach `git diff` selbst zu rufen. Ein Tool-Call gespart, deterministischer Input.

Genutzt richtig, ersetzt das eine Reihe von Tool-Calls. Genutzt falsch, baust du dir einen langsamen Hook, der bei jeder Skill-Aktivierung wartet. Faustregel: nur deterministische, schnelle Befehle (Git-Status, aktuelles Datum, `pwd`).

## Bundling: Skills im Plugin

Willst du Skills teilen, mit Team, Community oder deinem Future-Self auf einem anderen Rechner, baust du ein Plugin.

Minimaler Plugin-Aufbau:

```
my-skill-bundle/
├── plugin.json
└── skills/
    ├── alex-writing-identity/
    │   └── SKILL.md
    └── deploy-alexle135/
        └── SKILL.md
```

Die `plugin.json` ist die Manifest-Datei. Skills im Plugin sind danach unter `plugin-name:skill-name` aufrufbar. Bei mir also `alex-writing-identity:alex-writing-identity` oder kürzer per Frontmatter-Override.

Plugins kann man als Git-Repo verteilen und über das Marketplace-System installieren. Bei mir liegt ein privates Plugin-Repo mit den Skills, die ich für sensibel halte (Bewerbungs-Skills, Server-Deploy-Skills), und ein öffentliches für die generischen.

## Was wehtut

Auch hier: ich will nicht so tun, als wäre Skill-Engineering ein gelöstes Problem.

- **Description-Engineering ist Klassifikator-Engineering.** Schlecht formulierte Descriptions führen zu Skills, die nie laufen, oder zu Skills, die ständig false-positiv triggern. Dein Agent ist nicht dumm — aber er hat nur das, was du ihm gibst. Wenn du den Skill zwei Wochen testest und merkst, dass er nur zu 60% korrekt triggert, ist meistens die Description schuld.
- **`SKILL.md`-Body lebt im Kontext, sobald geladen.** Tokens werden nicht magisch frei. Ein 8.000-Token-Skill, der bei jeder dritten Session lädt, ist teuer. Halte den Body schlank, lager Tiefe in `references/` aus, die nur bei Bedarf gelesen werden.
- **Compaction killt teilgeladene Skills.** Wenn dein Skill mitten in der Session geladen wurde und Compaction kommt, kann der Skill-Inhalt aus dem Kontext fallen, ohne dass der Agent merkt, dass er wieder ohne ihn arbeitet. Workaround: Wichtige Konstanten zusätzlich in CLAUDE.md.
- **Versionierung ist hand-gepflegt.** Es gibt aktuell keinen Mechanismus, der dir sagt: "Skill X wurde aktualisiert, willst du upgraden?". Du synchronisierst über Git, oder du vergisst eine Variante.

## Wann das was bringt

Skills lohnen sich, wenn:

- du dich **wiederholt erklären** musst (Stil, Konventionen, Repo-Eigenheiten)
- du **wiederkehrende Sequenzen** hast (Deploy, Backup, Routine-Checks)
- du **Multi-Tool-Workflows** orchestrieren willst, ohne jedesmal die Reihenfolge zu erklären
- du **Persona-Konsistenz** brauchst (Agent-Antworten, Ghost-Writing)

Nicht sinnvoll:

- Einmalige Aufgaben — die gehen in den normalen Prompt
- Sehr breite "macht alles"-Skills — du bekommst keinen verlässlichen Klassifikator, der den Skill korrekt zieht
- Sicherheitskritische Aktionen ohne `disable-model-invocation: true` — der Agent triggert sonst Skill X im Eifer und zerschießt dir was

## Nächste Schritte

Ich baue gerade ein kleines Eval-Skript, das Beispiel-Prompts gegen meine Skills schießt und prüft, ob der richtige Skill triggert. Banales Klassifikator-Testing, hilft mir aber bei elf Skills, Regressionen früh zu sehen.

Wer anfangen will: nimm dir die Aufgabe vor, die du zweimal pro Woche erklärst. Wenn dich die dritte Erläuterung nervt, lohnt der Skill. Wenn du den Inhalt einmal im Monat brauchst, gehört er in den Prompt, nicht in einen Skill.

Mein größter Lerneffekt war eigentlich nicht technisch. Wer Skills baut, schreibt keine Tools mehr, sondern Verhalten. Der Job liegt näher an Produktdesign als an Engineering, und genau deshalb fühlt sich der Agent nach ein paar Wochen wie ein vertrauter Kollege an statt wie ein generischer Chat-Bot.
