---
title: "Docker auf Ubuntu 24.04 - So habe ich's gemacht"
summary: Praktische Anleitung zur Docker-Installation mit allen Fehlern, die ich dabei gemacht habe
tldr: 'Docker Engine und Docker Compose sauber auf Ubuntu 24.04 installieren. Über das offizielle apt-Repo statt über snap, User in die docker-Gruppe aufnehmen, Post-Install-Test mit hello-world und die beiden Anfängerfallen (falsche GPG-Key-Quelle, sudo-Zwang nach Gruppen-Add ohne Re-Login), die ich selbst mitgemacht habe.'
tags:
  - Docker
  - Ubuntu
  - Linux
  - Tutorial
heroImage: ../../assets/blog/docker-ubuntu-setup.webp
publishedAt: 2025-11-08
author: Alexander Schneider
---

## Das Ziel

Ich wollte Docker auf Ubuntu 24.04 installieren und zum Laufen bringen. Das klingt erstmal einfach, war es für mich am Anfang aber nicht. Es gab einige Stolpersteine, die ich dir ersparen möchte.

## Warum Docker?

Docker verpackt deine Apps in Container – inklusive allem, was sie zum Laufen brauchen. Das bedeutet: Kein "Dependency-Chaos" mehr. Wenn es einmal gebaut ist, läuft es überall gleich.

In meiner FISI-Ausbildung kam ich um das Thema Docker nicht herum. Anstatt nur theoretisch darüber zu lesen, habe ich mich entschieden, es einfach praktisch umzusetzen.

## Was du brauchst

- Ein System mit Ubuntu 24.04 (andere Versionen funktionieren meist ähnlich)
- Root-Zugriff oder einen User mit `sudo`-Rechten
- Etwa 10-15 Minuten Zeit
- Eine aktive Internetverbindung

## Schritt-für-Schritt Anleitung

### Schritt 1: System aktualisieren

Bevor wir irgendetwas installieren, bringen wir das System auf den neuesten Stand. Das vermeidet Konflikte mit veralteten Paketen.

```bash
sudo apt update && sudo apt upgrade -y
```

### Schritt 2: Alte Docker-Versionen entfernen

Ich hatte den Fehler gemacht, eine alte Docker-Version aus dem Standard-Ubuntu-Repository zu nutzen. Diese war veraltet und machte Probleme mit `docker-compose`. Deshalb: Erstmal alles Alte wegputzen.

```bash
sudo apt remove docker docker-engine docker.io containerd runc
```

### Schritt 3: Das offizielle Docker Repository hinzufügen

Wir wollen die neueste Version direkt von Docker, nicht die veraltete von Ubuntu. Dafür müssen wir das Repository und den GPG-Key hinzufügen.

```bash
# Notwendige Tools installieren
sudo apt install ca-certificates curl gnupg lsb-release -y

# Docker GPG Key sicher hinzufügen
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Das Repository zur Quellenliste hinzufügen
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Schritt 4: Docker installieren

Jetzt, wo die Quelle bekannt ist, können wir Docker und die zugehörigen Plugins installieren.

```bash
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
```

### Schritt 5: Installation überprüfen

Lass uns checken, ob alles geklappt hat.

```bash
docker --version
```

Du solltest eine Ausgabe sehen, die in etwa so aussieht: `Docker version 24.0.7, build afdd53b`.

### Schritt 6: Docker ohne sudo nutzen (Optional aber empfohlen)

Standardmäßig musst du vor jeden Docker-Befehl `sudo` schreiben. Das nervt auf Dauer gewaltig. Wir fügen daher unseren User zur `docker`-Gruppe hinzu.

```bash
sudo usermod -aG docker $USER
```

**Wichtig:** Damit das wirksam wird, musst du dich einmal aus- und wieder einloggen (oder `newgrp docker` eingeben).

## Der Funktionstest

Jetzt kommt der Moment der Wahrheit. Wir starten den berühmten "Hello World" Container.

```bash
docker run hello-world
```

Wenn alles passt, siehst du:

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

## Fehler, die ich gemacht habe (und wie du sie vermeidest)

### Fehler 1: Installation über Snap

Ich habe zuerst versucht, Docker über Snap zu installieren. Das führte zu seltsamen Berechtigungsproblemen und Container konnten teilweise nicht auf Dateien zugreifen.
**Lösung:** Snap-Version deinstallieren und den offiziellen Weg (siehe oben) nutzen.

### Fehler 2: Firewall blockiert Docker

Die UFW-Firewall hat bei mir die Docker-Ports blockiert, sodass Container keine Internetverbindung hatten.
**Lösung:** Ich musste die Kommunikation erlauben:

```bash
sudo ufw allow from 172.17.0.0/16 to any
```

### Fehler 3: Docker Daemon läuft nicht

Nach der Installation lief der Docker-Dienst nicht automatisch an.
**Lösung:** Manuelles Starten und Aktivieren des Autostarts:

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

## Nächste Schritte

Jetzt wo Docker läuft, kannst du loslegen:

1.  **Starte deinen ersten Webserver:**
    `docker run -d -p 80:80 nginx`
2.  **Lerne Docker Compose:**
    Damit kannst du ganze Umgebungen (z.B. Webserver + Datenbank) in einer Datei definieren.
3.  **Baue dein eigenes Image:**
    Schreibe ein `Dockerfile` und lade dein eigenes Image auf Docker Hub hoch.

**Tipp:** Willst du Docker-Befehle erstmal ohne echten Server üben? In meinen [Terminal Missionen](/projekte/terminal-missionen/app/) gibt es einen Docker-Track direkt im Browser.

## Fazit

Die Docker-Installation auf Ubuntu ist eigentlich straightforward, wenn man weiß, wie es geht und die Fallstricke (wie Snap) vermeidet. Die 15 Minuten Investition lohnen sich definitiv, denn Container sind aus der modernen IT nicht mehr wegzudenken.

Bei Fragen schreib mir gerne: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)
