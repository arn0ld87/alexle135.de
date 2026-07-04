---
title: "SSH-Keys einrichten – so hab ich's endlich verstanden"
summary: 'Ich hab mich ewig mit Passwörtern rumgeschlagen. Dann hab ich SSH-Keys eingerichtet. Hier ist, wie das geht.'
tldr: 'SSH-Keys ersetzen das Passwort beim Login durch ein Schlüsselpaar aus privatem und öffentlichem Key. Das ist im Alltag schneller, für Skripte oft nötig und mit Passphrase sauber abgesichert. Wichtig sind vor allem korrekte Dateirechte, eine getestete zweite Session und eine klare Trennung zwischen privaten und öffentlichen Schlüsseln.'
publishedAt: 2025-11-20
updatedAt: 2026-04-20
tags:
  - Linux
  - SSH
  - Sicherheit
  - Tutorial
heroImage: /images/blog/ssh-keys-einrichten-linux.webp
author: Alexander Schneider
---

## Warum ich das brauchte

Ich hatte irgendwann drei Situationen gleichzeitig:

- mehrere Server im Homelab
- ein VPS, auf den ich regelmäßig per SSH musste
- Skripte für Backups und Deploys

Mit Passwort-Login funktioniert das am Anfang noch. Danach nervt es nur noch. Vor allem dann, wenn ein Script nachts etwas tun soll und niemand daneben sitzt, um ein Passwort einzutippen.

SSH-Keys waren für mich nicht einfach ein Komfort-Upgrade. Ab da wurde Automatisierung erst sinnvoll.

## Was SSH-Keys eigentlich sind

Du erzeugst ein Schlüsselpaar:

- **privater Key** auf deinem Rechner
- **öffentlicher Key** auf dem Server

Beim Login prüft der Server, ob dein privater Key zu einem hinterlegten öffentlichen Key passt. Wenn ja, lässt er dich rein. Das Passwort wird dabei nicht ersetzt durch "gar keine Sicherheit", sondern durch ein anderes Verfahren.

Der wichtige Punkt: Der **private Key bleibt immer bei dir**. Auf den Server kommt nur der öffentliche Teil.

## Wann sich das wirklich lohnt

SSH-Keys lohnen sich sofort, wenn mindestens einer dieser Punkte auf dich zutrifft:

- du meldest dich mehrmals am Tag an Servern an
- du willst `rsync`, `scp`, Git-Deploys oder Backups automatisieren
- du nutzt mehrere Hosts und willst die Zugänge sauber trennen
- du willst Passwort-Login später abschalten

Gerade der letzte Punkt ist wichtig. Viele richten zuerst SSH-Keys ein, weil es bequemer ist. Später merken sie: Das war auch der saubere Weg, um den SSH-Zugang insgesamt härter zu machen.

## Was du brauchst

- Linux, macOS, WSL oder ein anderes System mit OpenSSH
- einen Server mit laufendem SSH-Dienst
- einmal funktionierenden Passwort-Zugang für die Ersteinrichtung
- zehn bis fünfzehn Minuten Ruhe

## Schritt 1: Key erzeugen

Ich würde heute direkt `ed25519` nehmen.

```bash
ssh-keygen -t ed25519 -C "dein@email.de"
```

Das macht zwei Dateien:

- `~/.ssh/id_ed25519`
- `~/.ssh/id_ed25519.pub`

Kurz dazu:

- `-t ed25519` wählt einen modernen, schnellen und in der Praxis sinnvollen Algorithmus.
- `-C` setzt nur einen Kommentar. Das ist kein Sicherheitsfeature. Es hilft dir später nur beim Wiedererkennen.

Wenn du nach dem Speicherort gefragt wirst, kannst du für den ersten Key einfach den Standard nehmen.

### Passphrase ja oder nein

Meine Empfehlung: **ja**.

Ein privater Key ohne Passphrase ist praktisch, aber wenn dein Laptop offen herumliegt oder jemand an dein Benutzerkonto kommt, ist der Key sofort nutzbar. Mit Passphrase ist noch eine Hürde dazwischen.

Ich habe mir am Anfang eingeredet, dass eine Passphrase im Alltag nur nervt. Später habe ich gemerkt, dass ich den Key sowieso im Agent lade. Seitdem ist die Passphrase kein echtes Problem mehr.

## Schritt 2: Public Key auf den Server kopieren

Am bequemsten geht es so:

```bash
ssh-copy-id user@server-ip
```

Du gibst dabei noch einmal dein Passwort ein. Danach wird dein Public Key in `~/.ssh/authorized_keys` auf dem Server eingetragen.

Falls `ssh-copy-id` nicht vorhanden ist, geht es auch manuell:

```bash
cat ~/.ssh/id_ed25519.pub
```

Dann den Inhalt auf dem Server in diese Datei einfügen:

```bash
~/.ssh/authorized_keys
```

## Was auf dem Server intern passiert

Genau dieser Teil hat mir am Anfang gefehlt.

- SSH schaut in dein Home-Verzeichnis
- dort in `~/.ssh/authorized_keys`
- und prüft, ob einer der eingetragenen Public Keys zum privaten Key auf deinem Rechner passt

Wenn die Datei fehlt, der Key falsch ist oder die Rechte nicht stimmen, kommt oft einfach nur:

```text
Permission denied (publickey)
```

Das wirkt erstmal unhilfreich, ist aber meistens auf genau diese drei Ursachen zurückzuführen.

## Die Rechte müssen stimmen

Das ist der Fehler, den ich mir selbst gebaut habe.

Ich hatte den Key einmal manuell eingetragen, aber die Rechte auf dem Server nicht sauber gesetzt. SSH hat die Datei dann aus Sicherheitsgründen ignoriert.

Die Korrektur:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

SSH ist bei Berechtigungen absichtlich streng. Wenn andere Benutzer da mitlesen könnten, wird der Login im Zweifel verweigert.

## Schritt 3: Login testen

Jetzt ganz normal verbinden:

```bash
ssh user@server-ip
```

Wenn alles stimmt, kommst du direkt rein oder wirst nur nach der Passphrase deines privaten Keys gefragt.

### Der wichtigste Praxistipp an dieser Stelle

Mach **nicht sofort** die erste Session zu und ändere dann hektisch die Server-Konfiguration.

Ich mache es inzwischen immer so:

1. erste SSH-Session offen lassen
2. zweite, neue SSH-Session zusätzlich öffnen
3. erst wenn auch die zweite Session sauber per Key reinkommt, weiter härten

Das klingt banal, spart dir aber genau den Moment, in dem du dich selbst aussperrst.

## Schritt 4: SSH-Config anlegen

Sobald du mehr als einen Host hast, lohnt sich `~/.ssh/config`.

```bash
# ~/.ssh/config
Host homeserver
    HostName 192.168.1.100
    User alex
    IdentityFile ~/.ssh/id_ed25519

Host proxmox
    HostName 192.168.1.50
    User root
    IdentityFile ~/.ssh/id_ed25519
```

Danach reicht:

```bash
ssh homeserver
ssh proxmox
```

Der eigentliche Vorteil ist aber nicht das Tippen. Wichtiger ist: `scp`, `rsync`, Git und viele Deploy-Skripte nutzen dieselbe Config mit.

## Mehrere Keys sauber trennen

Wenn du nur einen privaten Key für alles nutzt, funktioniert das erstmal. Auf Dauer wird es aber unübersichtlich.

Ich würde heute trennen nach Zweck:

- ein Key für Homelab
- ein Key für den VPS
- optional ein eigener Key für Git-Hosting

Dann sieht das so aus:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_vps -C "vps"
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_homelab -C "homelab"
```

Und in der Config:

```bash
Host vps
    HostName 203.0.113.10
    User admin
    IdentityFile ~/.ssh/id_ed25519_vps

Host pve
    HostName 192.168.1.50
    User root
    IdentityFile ~/.ssh/id_ed25519_homelab
```

Das ist nicht nur ordentlicher. Wenn später ein Zugang weg soll, musst du nicht überall denselben Key austauschen.

## Schritt 5: Agent nutzen

Wenn dein Key eine Passphrase hat, ist der SSH-Agent praktisch:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

Dann gibst du die Passphrase einmal ein, nicht bei jeder Verbindung.

Auf Desktop-Systemen läuft das oft ohnehin im Hintergrund. Auf Servern, frischen Shells oder WSL muss man es manchmal bewusst initialisieren.

## Häufige Fehler

### `Permission denied (publickey)`

Prüfe in dieser Reihenfolge:

```bash
ls -la ~/.ssh/
cat ~/.ssh/authorized_keys
```

Dann:

- liegt dein Public Key wirklich in `authorized_keys`?
- stimmen `700` für `.ssh` und `600` für `authorized_keys`?
- nutzt du auf dem Client wirklich den richtigen privaten Key?

### Falscher Key wird angeboten

Das passiert schnell, wenn du mehrere Keys hast.

Lösung:

```text
IdentityFile ~/.ssh/id_ed25519_vps
```

explizit in der Config setzen.

### Server antwortet, aber fragt weiter nach Passwort

Dann wurde der Key meist nicht akzeptiert. Oft liegt es an:

- falschem Benutzer
- falscher Datei
- falschen Rechten
- oder daran, dass du den Public Key auf dem falschen Host eingetragen hast

### Agent hat den Key nicht geladen

Wenn du eine Passphrase gesetzt hast und trotzdem ständig neu gefragt wirst:

```bash
ssh-add -l
```

Wenn dort nichts Sinnvolles auftaucht, musst du den Key noch laden.

## Danach: Passwort-Login abschalten

Erst wenn Key-Login wirklich stabil funktioniert, kannst du den Passwort-Login auf dem Server deaktivieren:

```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
```

Danach den Dienst neu laden, je nach Distribution zum Beispiel so:

```bash
sudo systemctl restart sshd
```

Oder auf Debian/Ubuntu:

```bash
sudo systemctl restart ssh
```

### Was ich dabei heute anders mache

Ich ändere so etwas nie in einer einzigen offenen Session. Ich lasse immer eine funktionierende Verbindung stehen, teste eine zweite Verbindung von einem neuen Terminal und ändere erst danach `sshd_config`.

Das kostet zwei Minuten mehr und spart im Zweifel den Gang zur Server-Konsole.

## Fazit

SSH-Keys sind kein kompliziertes Spezialthema. Es sind zwei Dateien, ein Eintrag auf dem Server und saubere Rechte.

Der eigentliche Gewinn kommt danach:

- weniger Reibung im Alltag
- saubere Automatisierung
- klarere Trennung zwischen Clients und Hosts
- die Möglichkeit, Passwort-Login später wirklich abzuschalten

Wenn du nur einen Server hast, lohnt es sich schon. Wenn du zwei oder mehr hast, willst du danach nicht mehr zurück.

**Weiterlesen:** [Die 10 wichtigsten Linux-Befehle](/blog/linux-befehle-fuer-einsteiger/)
