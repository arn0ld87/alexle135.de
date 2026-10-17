---
title: 'Claude Code sicher im DevContainer laufen lassen'
metaDescription: 'Claude Code im DevContainer absichern: Anthropics Referenz-Setup mit Outbound-Firewall nachbauen und den Zugriff eines Coding-Agenten begrenzen.'
summary: 'Einen Coding-Agenten unbeaufsichtigt durchlaufen zu lassen ist verlockend und riskant zugleich. Anthropics Referenz-DevContainer sperrt den Agenten in einen Container mit Outbound-Firewall. So baust du das Setup nach.'
tags:
  - Claude Code
  - DevContainer
  - Docker
  - Security
  - AI-Coding
  - Firewall
heroImage: ../../assets/blog/claude-code-im-devcontainer-absichern.webp
heroImageAlt: 'Coding-Agent isoliert in einem Docker-Container mit eingeschränktem Netzwerkzugang'
publishedAt: 2026-06-27
draft: false
faq:
  - question: Was macht --dangerously-skip-permissions genau?
    answer: Der Flag schaltet die Rückfragen vor jedem Tool-Aufruf ab, sodass der Agent Befehle ohne Bestätigung ausführt. Das spart Zeit bei langen Läufen, entfernt aber dein Kontrollfenster. Claude Code lehnt den Flag ab, wenn es als root gestartet wird, deshalb braucht der Container einen Nicht-root-Nutzer.
  - question: Schützt der DevContainer komplett vor Schaden?
    answer: Nein. Der Container begrenzt den Radius, ist aber keine Garantie. Mit übersprungenen Permissions kann der Agent jede Datei im gemounteten Workspace ändern, und der liegt direkt auf deinem Host. Nutze das Setup nur mit vertrauenswürdigem Code und kombiniere es mit der Netzwerk-Allowlist.
  - question: Brauche ich für die Firewall besondere Rechte?
    answer: Ja. Die Firewall im Container setzt iptables-Regeln, dafür braucht der Container die Capabilities NET_ADMIN und NET_RAW. Die fügst du über runArgs in der devcontainer.json hinzu. Ohne sie startet das Firewall-Skript nicht.
---

Es gibt diesen Punkt bei der Arbeit mit Coding-Agenten, an dem du den Flag `--dangerously-skip-permissions` setzt. Erst zögerlich, dann gewohnheitsmäßig. Der Agent fragt nicht mehr vor jedem Befehl nach, läuft durch, erledigt die Aufgabe. Produktiv. Und irgendwann sitzt du da und denkst: Der führt gerade beliebige Shell-Befehle auf meiner Maschine aus, ohne dass ich hinschaue.

Anthropics eigene Engineers fahren diesen Flag nicht auf bare metal. Sie sperren den Agenten in einen Container. Genau dafür gibt es einen Referenz-DevContainer im offiziellen `claude-code`-Repo, und das Prinzip dahinter ist simpel: Wenn der Agent schon ohne Rückfrage arbeiten soll, dann in einer Umgebung, deren Radius du kennst. Der Blast-Radius ist der Container, nicht dein Laptop.

Im deutschsprachigen Raum erklären viele Claude Code als Tool. Das Sicherheits-Setup drumherum, vor allem die Outbound-Firewall, fehlt fast überall. Genau die ist aber der interessante Teil.

## Warum ein Container und nicht nur ein Flag

Ein Coding-Agent macht zwei Dinge, die gefährlich werden können. Er führt Befehle aus, und er hat Netzwerkzugang. Ohne Rückfragen heißt das: Er kann theoretisch Dateien außerhalb deines Projekts anfassen und Daten irgendwohin schicken.

Der Container begrenzt das erste Problem, indem nur das Projektverzeichnis hineingemountet wird. Die Firewall begrenzt das zweite, indem ausgehender Traffic per Default verboten ist und nur eine kurze Allowlist durchkommt. Beides zusammen macht aus "der Agent darf alles" ein "der Agent darf alles innerhalb dieser Wände".

Wichtig, und das schreibt Anthropic selbst dazu: Vollständigen Schutz gibt es nicht. Ein bösartiges Projekt kann im Container immer noch anrichten, was die Wände erlauben. Nutze das Setup für vertrauenswürdige Repos, nicht als Sandbox für fremden, unbekannten Code.

## Schritt 1: Claude Code als DevContainer-Feature

Der einfachste Einstieg ist das offizielle Feature. Du brauchst keine eigene Image-Bastelei, du hängst es an deine `devcontainer.json`:

```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/anthropics/devcontainer-features/claude-code:1.0": {}
  }
}
```

Der Versions-Tag `:1.0` pinnt das Install-Skript des Features, nicht die Claude-Code-Version. Das Feature installiert immer die aktuelle CLI, und die aktualisiert sich im Container per Default selbst.

Danach in VS Code die Befehlspalette öffnen mit `Cmd+Shift+P` beziehungsweise `Ctrl+Shift+P` und **Dev Containers: Rebuild Container** ausführen. Im neu gebauten Container ein Terminal öffnen, `claude` starten, anmelden. Das war die Basis.

## Schritt 2: Anmeldung über Rebuilds retten

Standardmäßig wirft der Container sein Home-Verzeichnis beim Rebuild weg, und du musst dich jedes Mal neu anmelden. Claude Code legt Token und Einstellungen unter `~/.claude` ab. Mounte dort ein benanntes Volume:

```json
{
  "mounts": ["source=claude-code-config,target=/home/node/.claude,type=volume"]
}
```

Ersetze `/home/node` durch das Home-Verzeichnis deines `remoteUser`. Die Referenzkonfiguration hängt an den Volume-Namen noch `${devcontainerId}` an, damit jedes Projekt seinen eigenen Stand bekommt:

```json
"source=claude-code-config-${devcontainerId}"
```

## Schritt 3: Ausgehenden Traffic einsperren

Hier wird es interessant. Der Referenz-Container bringt ein Skript `init-firewall.sh` mit, das allen ausgehenden Verkehr blockt und nur durchlässt, was Claude Code und deine Tools brauchen. Das Skript setzt eine Default-Deny-Policy:

```bash
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
```

Vorher erlaubt es DNS auf Port 53, SSH auf Port 22 und Localhost. Dann baut es ein ipset namens `allowed-domains` auf:

```bash
ipset create allowed-domains hash:net
```

Gefüllt wird die Allowlist auf zwei Wegen. Die GitHub-Adressbereiche zieht das Skript live über die Meta-API. Das geschieht noch bevor die Drop-Policy scharf gestellt wird, sonst käme dieser Abruf selbst nicht durch:

```bash
curl -s https://api.github.com/meta
```

Den Rest löst es per `dig` auf und trägt die IPs einzeln ein. Durchgelassen werden am Ende GitHub für Web, API und Git, die npm-Registry, die Anthropic-Endpunkte sowie Sentry, Statsig und die VS-Code-Dienste. Nichts sonst.

Am Schluss verifiziert sich das Skript selbst mit zwei Tests. Eine gesperrte Adresse muss scheitern, eine erlaubte muss klappen:

```bash
# muss fehlschlagen
curl --connect-timeout 5 https://example.com
# muss klappen
curl --connect-timeout 5 https://api.github.com/zen
```

Wenn der erste Aufruf durchkommt, ist die Firewall kaputt. Dieser Selbsttest ist der Teil, den ich am meisten mag, weil er das Setup ehrlich macht.

Damit das Skript im Container überhaupt iptables anfassen darf, braucht der Container zwei Capabilities. Die hängst du über `runArgs` an:

```json
{
  "runArgs": ["--cap-add=NET_ADMIN", "--cap-add=NET_RAW"]
}
```

Beides ist optional für Claude Code selbst. Du kannst die Firewall weglassen und dich auf deine eigenen Netzregeln verlassen. Wer den Agenten aber unbeaufsichtigt laufen lässt, will diese Wand.

## Schritt 4: Ohne Rückfragen laufen lassen

Jetzt schließt sich der Kreis. Weil der Container Claude Code als Nicht-root-Nutzer fährt und Befehle auf den Container begrenzt sind, kannst du den Flag setzen, um den du sonst einen Bogen machst:

```bash
claude --dangerously-skip-permissions
```

Die CLI weist diesen Flag ab, wenn sie als root gestartet wird. Stell also sicher, dass `remoteUser` ein Nicht-root-Konto ist, etwa `node`. Skipping permissions nimmt dir das Kontrollfenster vor jedem Tool-Aufruf. Der Agent kann weiter jede Datei im gemounteten Workspace ändern, und der liegt direkt auf deinem Host. Deshalb gehört dieser Flag mit der Netzwerk-Allowlist zusammen und nicht ohne sie.

Wer weniger Rückfragen will, ohne ganz auf Prüfung zu verzichten, schaut sich den Auto-Modus an. Da prüft ein Klassifizierer die Aktionen, bevor sie laufen. Und wenn du in einem Team verhindern willst, dass jemand den Bypass überhaupt nutzt, sperrst du ihn über die Managed Settings:

```json
{ "permissions": { "disableBypassPermissionsMode": "disable" } }
```

## Den kompletten Referenz-Container nehmen

Wenn du nicht Stück für Stück bauen willst, klonst du das `claude-code`-Repo und öffnest es in VS Code. Beim Prompt **Reopen in Container** klicken. Die Referenzkonfiguration besteht aus drei Dateien: `devcontainer.json` für Mounts, Capabilities und Extensions, `Dockerfile` für Basis-Image und Tools, und `init-firewall.sh` für die Egress-Sperre. Du kannst den Ordner in dein eigenes Projekt kopieren und das Dockerfile auf deinen Stack anpassen.

Für mich ist das der ehrlichste Umgang mit Coding-Agenten. Nicht den Flag verteufeln und nicht blind setzen, sondern eine Umgebung bauen, in der das Risiko bekannt und begrenzt ist. Der Agent darf schnell sein. Er darf nur nicht raus.
