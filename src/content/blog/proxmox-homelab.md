---
title: 'Proxmox Heimlabor: Server-Setup für unter 500€'
summary: Wie ich mein Heimlabor mit Proxmox aufgebaut habe - Hardware, Installation, VMs und was ich dabei gelernt habe
tags:
  - Proxmox
  - Homelab
  - Virtualisierung
  - Server
heroImage: ../../assets/blog/proxmox-homelab.webp
publishedAt: 2025-11-12
author: Alexander Schneider
---

## Warum ein Heimlabor?

Als FISI-Umschüler kommst du um praktische Erfahrung nicht herum. Theorie aus Büchern ist wichtig, aber nichts ersetzt das Gefühl, einen echten Server zu konfigurieren und auch mal etwas kaputt zu machen.

Mein Ziel war ein Heimlabor, in dem ich Docker-Container testen, VMs für verschiedene Linux-Distros aufsetzen, Netzwerke simulieren und CI/CD-Pipelines bauen kann – ohne Angst haben zu müssen, mein produktives System zu zerschießen.

## Die Hardware

Ich wollte nicht zu viel Geld ausgeben, aber trotzdem genug Leistung haben.

**Der Hauptserver (gebraucht):**
Ich habe mir einen gebrauchten Lenovo ThinkCentre Office-PC für ca. 350€ geholt.

- **CPU:** Intel i5-8500 (6 Kerne sind für den Anfang super)
- **RAM:** 32 GB DDR4 (Wichtig! RAM ist meistens der Flaschenhals bei Virtualisierung)
- **Storage:** Eine 256 GB NVMe SSD für das System und schnelle VMs, sowie eine 1 TB SATA SSD als Datengrab.

**Zusätzliche Hardware:**
Dazu kamen ein kleiner Managed Switch von TP-Link (35€), eine zusätzliche Netzwerkkarte (15€) und eine gebrauchte USV (80€), damit bei Stromausfall nicht alles crasht.

**Gesamtkosten:** Etwa 480€.

## Proxmox Installation

**Warum Proxmox?**
Es ist kostenlos, Open Source und bietet ein fantastisches Webinterface. Du kannst damit sowohl "echte" VMs (KVM) als auch leichtgewichtige Container (LXC) verwalten.

**Die Installation:**

1.  ISO von der Proxmox-Website laden.
2.  Mit Rufus oder Balena Etcher auf einen USB-Stick ziehen.
3.  Vom Stick booten und dem Installer folgen.

**Wichtig:** Merke dir die IP-Adresse, die du vergibst! Danach läuft die gesamte Verwaltung bequem über den Browser.

### Erste Schritte nach der Installation

Nach dem ersten Login solltest du das System aktualisieren und das Community-Repository aktivieren (da du wahrscheinlich keine Enterprise-Lizenz hast).

```bash
# Updates installieren
apt update && apt dist-upgrade -y

# Enterprise-Repo deaktivieren & Community-Repo hinzufügen
rm /etc/apt/sources.list.d/pve-enterprise.list
echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" > /etc/apt/sources.list.d/pve-community.list
```

## Netzwerk-Konfiguration

Ich habe mich für ein Setup mit VLANs entschieden, um verschiedene Bereiche zu trennen.

- **VLAN 10 (Management):** Hier liegt Proxmox selbst und der SSH-Zugriff.
- **VLAN 20 (Produktiv):** Hier laufen Dienste, die immer verfügbar sein sollen (wie mein DNS-Server).
- **VLAN 30 (Test):** Hier darf experimentiert werden. Wenn ich hier etwas kaputt mache oder mir Malware einfange, bleibt der Rest sicher.

## VMs und Container

**Was läuft bei mir?**

1.  **Ubuntu 24.04 LTS:** Mein Haupt-Docker-Host. Hier laufen Portainer, Traefik und diverse Web-Services.
2.  **Debian 12:** Eine reine Test-Umgebung für Kubernetes-Experimente.
3.  **Alpine Linux LXC:** Extrem ressourcensparende Container für Basis-Dienste wie Pi-hole (Werbeblocker) und einen Nginx Reverse Proxy.
4.  **Windows 11:** Nur bei Bedarf an, um Active Directory oder PowerShell-Skripte zu testen.

**Pro-Tipp: Templates nutzen**
Installiere eine VM einmal perfekt (Updates, User, SSH-Keys). Dann konvertiere sie in Proxmox zu einem "Template". Wenn du eine neue VM brauchst, klonst du einfach das Template und bist in 2 Minuten startklar.

## Storage und Backups

Ich trenne System und Daten. Proxmox und die VM-Disks liegen auf der schnellen NVMe. Backups, ISO-Images und größere Datenmengen liegen auf der SATA SSD.

**Backup-Strategie:**
Proxmox hat ein geniales Backup-Tool integriert. Meine VMs werden jede Nacht um 2:00 Uhr automatisch gesichert. Ich behalte die letzten 7 Tage. Wichtig: Kopiere diese Backups regelmäßig auf eine externe Platte oder ein NAS, falls der Server selbst mal abraucht.

## Stromverbrauch

Das war meine größte Sorge, ist aber halb so wild. Im Leerlauf (Idle) zieht der Server ca. 35 Watt. Unter Last geht es auf 80 Watt hoch. Im Schnitt liege ich bei ca. 11€ Stromkosten im Monat. Das ist deutlich günstiger als ein vergleichbarer Root-Server im Rechenzentrum.

## Was ich falsch gemacht habe (Learnings)

1.  **Zu wenig RAM:** Mein erster Versuch war mit 16 GB. Das ist zu wenig, wenn man mal 3-4 VMs gleichzeitig laufen lassen will. 32 GB sollten es schon sein.
2.  **Kein RAID:** Mir ist einmal eine SSD gestorben und ich musste alles neu aufsetzen. Backups hatte ich, aber das Recovery hat gedauert. Mein nächstes Upgrade wird ein ZFS-Mirror (RAID 1).
3.  **Keine USV:** Ein kurzer Stromausfall hat mir mal eine Datenbank zerschossen. Die 80€ für eine gebrauchte USV sind gut investiertes Geld.

## Fazit

Für unter 500€ habe ich ein Setup, mit dem ich fast alles simulieren kann, was mir in der Ausbildung begegnet.

Ein eigenes Heimlabor ist Gold wert. Du lernst Dinge, die dir kein Buch beibringen kann: Wie man Fehler sucht, wie Netzwerke wirklich funktionieren und wie man Systeme wartet.

**Lohnt sich das?** Absolut!

Bei Fragen schreib mir gerne: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

**Zur Hardware:** Wie M.2-SSDs funktionieren und welche sich für einen Server lohnen, zeigt mein [Vortrag zur M.2-Schnittstelle](/projekte/m2-schnittstelle/).
