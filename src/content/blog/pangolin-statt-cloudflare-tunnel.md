---
title: 'Pangolin statt Cloudflare Tunnel: den eigenen Ingress-Pfad zurückholen'
metaDescription: 'Pangolin statt Cloudflare Tunnel: Mein Aufbau mit eigenem VPS als Eingangstor, Installer, Traefik und Newt-Connector für die Verbindung zum Homelab.'
summary: 'Cloudflare Tunnel ist bequem, aber dein Traffic läuft komplett über fremde Infrastruktur. Pangolin macht deinen eigenen VPS zum Eingangstor. Hier der komplette Aufbau mit Installer, Traefik und dem Newt-Connector.'
tags:
  - Self-Hosting
  - Pangolin
  - Cloudflare Tunnel
  - WireGuard
  - Traefik
  - Reverse Proxy
  - Homelab
heroImage: ../../assets/blog/pangolin-statt-cloudflare-tunnel.webp
heroImageAlt: 'Schematische Darstellung eines selbstgehosteten Ingress-Pfads mit VPS, WireGuard-Tunnel und Heimserver'
publishedAt: 2026-06-12
draft: false
faq:
  - question: Brauche ich für Pangolin eine offene Portfreigabe zu Hause?
    answer: Nein. Der Newt-Connector baut von innen einen WireGuard-Tunnel zum VPS auf. Eingehende Ports an deinem Heimanschluss bleiben zu. Das ist derselbe Grundgedanke wie bei Cloudflare Tunnel, nur dass der VPS dir gehört.
  - question: Was ist der Unterschied zwischen Gerbil und Newt?
    answer: Gerbil läuft auf dem VPS und ist die Server-Seite des WireGuard-Tunnels. Newt läuft hinter deiner Firewall, also auf dem Heimserver, und ist die Client-Seite. Der Installer setzt Gerbil mit auf, Newt installierst du pro Standort selbst.
  - question: Ersetzt Pangolin auch ein VPN wie Tailscale?
    answer: Teilweise. Pangolin kann private Ressourcen mit Authentifizierung bereitstellen und deckt damit einen Teil von Twingate oder Tailscale ab. Für ein klassisches Mesh-VPN zwischen vielen Geräten bleibt Tailscale die einfachere Wahl.
---

Cloudflare Tunnel läuft bei mir seit über einem Jahr, und technisch gibt es nichts zu meckern. Du installierst `cloudflared`, der Daemon baut von innen eine Verbindung zu Cloudflare auf, und deine Dienste sind erreichbar, ohne dass du zu Hause einen einzigen Port aufmachst. Bequem.

Der Haken steckt im Wort "zu Cloudflare". Jeder Request an deine Dienste läuft durch deren Netz. Du siehst die TLS-Terminierung nicht, du bestimmst den Pfad nicht, und wenn Cloudflare deinen Tunnel mag oder nicht mag, hast du wenig zu sagen. Für ein Hobby-Dashboard ist das egal. Sobald du anfängst, ernsthafte Dinge dahinter zu hängen, fühlt es sich falsch an, den kompletten Eingang an einen Dritten abzugeben.

Pangolin dreht das um. Dein VPS wird das Eingangstor. Ein kleiner Connector hinter deiner Firewall baut einen WireGuard-Tunnel nach außen auf, und Traffic läuft über deine Maschine, nicht über fremde. Auf Hacker News hat der Show-HN-Beitrag dazu 500 Punkte gesammelt, und der XDA-Artikel "I replaced Cloudflare Tunnel with Pangolin" trifft genau den Nerv: man will den eigenen Ingress-Pfad besitzen.

## Was Pangolin eigentlich ist

Pangolin von der Firma Fossorial ist ein selbstgehosteter Reverse-Proxy mit Tunnel-Management und Zugriffskontrolle. Drei Teile spielen zusammen:

- **Pangolin** ist die Steuerzentrale mit Dashboard und Auth.
- **Gerbil** ist die WireGuard-Server-Seite auf dem VPS.
- **Traefik** macht das eigentliche Routing und die TLS-Zertifikate.

Auf der anderen Seite, also hinter deiner Heim-Firewall, läuft **Newt**. Das ist der Connector, der den Tunnel von innen aufmacht. Newt bringt den WireGuard-Tunnel komplett im Userspace hoch, über netstack. Kein Kernel-Modul, keine Root-Rechte für das Interface, kein `NET_ADMIN`-Gefummel. Das ist der angenehme Teil.

## Voraussetzungen

- Ein VPS mit öffentlicher IP. Ein kleiner reicht, ich nutze einen Hetzner CX22.
- Eine Domain, deren DNS du auf den VPS zeigen kannst.
- Docker und Docker Compose auf dem VPS.
- Ein Heimserver oder eine VM hinter der Firewall, auf dem deine Dienste laufen.

## Schritt 1: Pangolin auf dem VPS installieren

Fossorial liefert einen Installer, der den ganzen Compose-Stack zusammenbaut. Auf dem frischen VPS:

```bash
curl -fsSL https://static.pangolin.net/get-installer.sh | bash
sudo ./installer
```

Der erste Befehl lädt das Installer-Binary, der zweite startet die interaktive Einrichtung. Bevor du `curl ... | bash` ausführst: Lies das Skript einmal kurz an. Bei allem, was du auf einen Server mit öffentlicher IP kippst, ist das gute Gewohnheit.

Der Installer fragt dich der Reihe nach ab:

- **Edition**: Community oder Enterprise. Für Self-Hosting nimmst du Community.
- **Base Domain**: deine Root-Domain, etwa `example.com`.
- **Dashboard Domain**: Default ist `pangolin.example.com`.
- **Let's Encrypt E-Mail**: für die Zertifikate und gleichzeitig der erste Admin-Login.
- **Tunneling**: ob Gerbil mitinstalliert wird. Sag ja, sonst hast du keinen Tunnel.

Danach zieht der Installer die Images für `pangolin`, `gerbil` und `traefik` und startet sie. Nach zwei, drei Minuten läuft der Stack.

Den Setup-Token für den ersten Login holst du aus den Logs:

```bash
sudo docker compose logs pangolin
```

Dann rufst du `https://pangolin.example.com/auth/initial-setup` auf, gibst den Token ein und legst Admin-Account plus erste Organisation an.

## Schritt 2: Eine Site mit Newt verbinden

Im Dashboard legst du eine neue Site an. Pangolin generiert dafür eine ID und ein Secret und zeigt dir direkt das passende Newt-Kommando. Auf deinem Heimserver sieht das so aus:

```bash
docker run -d \
  --name newt \
  --restart unless-stopped \
  -e PANGOLIN_ENDPOINT=https://pangolin.example.com \
  -e NEWT_ID=<deine-newt-id> \
  -e NEWT_SECRET=<dein-newt-secret> \
  fosrl/newt
```

Sobald der Container läuft, taucht die Site im Dashboard als verbunden auf. Die ID und das Secret kommen aus dem Dashboard, du musst sie nicht erfinden. Newt baut jetzt den Tunnel von innen nach außen auf, und an deinem Router bleibt jeder eingehende Port zu.

## Schritt 3: Einen Dienst veröffentlichen

Jetzt kommt der eigentliche Punkt. Nehmen wir an, auf deinem Heimserver läuft ein Dienst auf `http://192.168.1.20:8080`. Im Dashboard legst du eine Resource an, hängst sie an deine Site, vergibst eine Subdomain wie `app.example.com` und trägst Ziel-IP und Port ein.

Pangolin schreibt daraus die Traefik-Konfiguration, holt das Zertifikat über Let's Encrypt und routet den Traffic durch den WireGuard-Tunnel an deinen Heimserver. Von außen erreichst du `https://app.example.com`, intern landet der Request über den Tunnel bei `192.168.1.20:8080`.

Der Unterschied zu Cloudflare Tunnel ist nicht die Bedienung, die ist ähnlich. Der Unterschied ist, wo die TLS-Terminierung passiert und wem die Maschine gehört, die den Traffic sieht. Bei Pangolin bist das du.

## Private Ressourcen mit Auth

Pangolin kann mehr als nur öffentlich machen. Du kannst eine Resource hinter einen Login legen, sodass nur authentifizierte Nutzer drankommen. Damit deckst du den Anwendungsfall ab, für den viele sonst Twingate oder Tailscale nehmen: ein internes Tool, das aus dem Internet erreichbar, aber nicht offen sein soll. Für ein reines Geräte-Mesh ist ein echtes VPN weiter die bessere Wahl. Aber für "ich will auf mein Grafana, ohne dass es jeder sieht" reicht Pangolin.

## Wann sich der Umzug lohnt

Wenn dein Cloudflare Tunnel läuft und du nie darüber nachdenkst, wo dein Traffic durchgeht, dann lass ihn laufen. Der Wechsel kostet dich einen VPS und etwas Einrichtung.

Spannend wird Pangolin, sobald du Wert darauf legst, den ganzen Weg vom Request bis zum Dienst selbst in der Hand zu haben. Ein VPS für ein paar Euro im Monat, ein Connector pro Standort, und der Eingang gehört wieder dir. Für mich war genau das der Grund.
