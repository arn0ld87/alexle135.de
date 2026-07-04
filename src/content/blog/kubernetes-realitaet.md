---
title: 'Warum Kubernetes NICHT für jeden Sinn macht'
summary: 'Die Realität hinter dem Hype. Ein praxisnaher Vergleich, wann ein Cluster geschäftskritisch ist und wann Docker Compose die bessere Systemarchitektur liefert.'
tags:
  - Kubernetes
  - Docker
  - DevOps
  - Realität
format: 'Essay'
readingTime: '06 min'
snippet: 'if (scale > N) k8s() else compose()'
heroImage: /images/blog/kubernetes-realitaet.webp
publishedAt: 2025-11-16
author: Alexander Schneider
---

## Der Hype

"Du musst unbedingt Kubernetes lernen!", "Ohne K8s bist du im DevOps verloren!", "Alle nutzen doch heute Kubernetes!"

Solche Sätze höre ich ständig. Aber ich sage dir: **Das stimmt so nicht.**

## Meine Erfahrung

Ich habe den Hype mitgemacht. Ich habe Kubernetes gelernt, Minikube installiert, Pods deployed, Services konfiguriert und Ingress-Controller aufgesetzt.

**Mein Fazit:** Für 90% meiner Projekte ist Kubernetes schlichtweg Overkill. Es ist, als würde man mit Kanonen auf Spatzen schießen.

## Was ist Kubernetes überhaupt?

Kubernetes (kurz K8s) ist ein System zur Orchestrierung von Containern. Es löst Probleme, die man erst ab einer gewissen Größe hat:

- Es verwaltet Container über viele Server hinweg.
- Es skaliert Anwendungen automatisch hoch und runter.
- Es kümmert sich um Load-Balancing.
- Es bietet "Self-Healing": Wenn ein Container abstürzt, wird er automatisch neu gestartet.

**Klingt gut, oder?** Ja, absolut. Aber dieser Funktionsumfang hat einen Preis.

## Die Komplexität

Um Kubernetes wirklich zu beherrschen, musst du eine Unmenge an neuen Konzepten lernen: Pods, Deployments, Services (ClusterIP, NodePort, LoadBalancer), Ingress, ConfigMaps, Secrets, Persistent Volumes, StatefulSets, Namespaces, RBAC... die Liste ist endlos.

Die Lernkurve ist extrem steil. Und auch der Setup-Aufwand ist enorm.

**Ein Vergleich:**

**Docker Compose:**
Du schreibst eine `docker-compose.yml` mit 10 Zeilen für einen Webserver und eine Datenbank. Ein Befehl (`docker-compose up`), und es läuft.

**Kubernetes:**
Du brauchst Deployment-YAMLs für Web und DB, Service-YAMLs für beide, PersistentVolume-Konfigurationen, Secrets, Ingress-Regeln... schnell bist du bei über 100 Zeilen YAML-Code für exakt das gleiche Ergebnis.

## Wann brauchst du Kubernetes?

**✅ Du solltest K8s nutzen, wenn:**

1.  **Multi-Server Deployment:** Du hast 10 oder mehr Server und musst Container effizient über diesen Cluster verteilen.
2.  **Hohe Verfügbarkeit:** Downtime kostet dich bares Geld und Self-Healing ist geschäftskritisch.
3.  **Auto-Scaling:** Dein Traffic schwankt extrem und du musst automatisch Instanzen hinzufügen oder entfernen.
4.  **Große Teams:** Mehrere Teams arbeiten unabhängig an der gleichen Plattform und brauchen Isolation (Namespaces).
5.  **Cloud-Native Apps:** Du baust eine echte Microservices-Architektur mit 20+ separaten Services.

**❌ Du brauchst KEIN Kubernetes, wenn:**

1.  **Kleines Projekt:** Du hast nur eine Handvoll Container und ein einziger Server reicht völlig aus.
2.  **Statische Last:** Dein Traffic ist vorhersehbar und du brauchst kein komplexes Auto-Scaling.
3.  **Solo-Developer:** Du bist alleine oder in einem kleinen Team. Deine Zeit ist begrenzt und sollte in Features fließen, nicht in Cluster-Management.
4.  **Monolith:** Du hast eine große, zusammenhängende Applikation und keine verteilten Microservices.

## Alternativen

### Docker Compose

Perfekt für kleine bis mittlere Projekte. Es ist einfach zu lernen, schnell aufgesetzt und deckt 90% der alltäglichen Use-Cases ab. Keine Cluster-Konfiguration, kein Overhead.

### Docker Swarm

Wenn du mehrere Server brauchst, aber Kubernetes zu komplex ist. Es ist nativ in Docker integriert und nutzt die gleiche Syntax wie Compose. Leider ist die Community kleiner und es hat weniger Features als K8s.

### Managed Kubernetes (GKE, EKS, AKS)

Wenn du unbedingt Kubernetes brauchst, aber den Cluster nicht selbst verwalten willst. Google, Amazon oder Microsoft übernehmen die "Hard Work" für dich. Das kostet, spart aber Nerven.

## Mein Setup

### Produktiv (alexle135.de)

Ich nutze einen einzelnen VPS bei Contabo. Darauf läuft **Docker Compose** für alle meine Services, **Traefik** als Reverse Proxy und **Portainer** für das Management.
Warum kein K8s? Weil ein Server reicht, der Traffic stabil ist und ich keine unnötige Komplexität will.

### Heimlabor (Lernen)

Hier nutze ich **Proxmox** und habe in einer VM **K3s** (ein leichtgewichtiges Kubernetes) installiert. Aber nur zum Lernen und Experimentieren, nicht für produktive Dienste, auf die ich mich verlassen muss.

## Die Wahrheit über "Alle nutzen Kubernetes"

In der Realität sieht es so aus:

- **Große Tech-Firmen (Google, Netflix):** Nutzen K8s, haben aber auch riesige, dedizierte DevOps-Teams dafür.
- **Mittelstand:** Manche nutzen es, oft ist es aber Overkill. Viele fahren mit Docker Compose oder Swarm besser.
- **Startups & kleine Teams:** Nutzen es selten. Zeit ist Geld, und einfache Lösungen werden bevorzugt.

## Was du WIRKLICH lernen solltest

Statt blind dem Hype zu folgen, empfehle ich diesen Lernpfad:

1.  **Docker Basics:** Verstehe Container, Images, Volumes und Netzwerke.
2.  **Docker Compose:** Lerne, wie man Multi-Container-Apps baut und managed.
3.  **Reverse Proxy:** Verstehe Traefik oder Nginx, HTTPS und Load-Balancing.
4.  **Monitoring:** Lerne, wie man Logs und Metriken sammelt.

Erst wenn du das alles beherrschst und wirklich an Grenzen stößt, dann schau dir Kubernetes an.

## Fazit

Kubernetes ist ein mächtiges Tool und ein Industriestandard für Enterprise-Umgebungen. Aber es ist auch komplex, zeitaufwändig und für viele Projekte schlichtweg nicht notwendig.

**Meine Empfehlung:**
Lerne Docker und Docker Compose perfekt. Lerne die Basics von Kubernetes für deinen Lebenslauf. Aber nutze K8s produktiv nur dann, wenn du es wirklich brauchst.

Nicht jedes Problem ist ein Nagel, nur weil du einen Hammer hast.

**Fragen?** [schneider@alexle135.de](mailto:schneider@alexle135.de)
