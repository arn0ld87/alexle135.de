---
title: 'Jujutsu (jj): das Git-kompatible VCS, zu dem Leute wirklich wechseln'
summary: 'Jujutsu legt sich über dein bestehendes Git-Repo und wirft Index und Stash raus. Alles ist ein Commit, nichts geht verloren. Ein praktischer Einstieg mit den Befehlen, die du am ersten Tag brauchst.'
tags:
  - Git
  - Jujutsu
  - Versionierung
  - CLI
  - Tooling
  - FISI
heroImage: /images/blog/jujutsu-jj-statt-git.webp
heroImageAlt: 'Terminal mit jj-Befehlen über einem bestehenden Git-Repository'
publishedAt: 2026-06-03
draft: false
faq:
  - question: Muss ich Git aufgeben, wenn ich jj benutze?
    answer: Nein. jj schreibt in dasselbe .git-Verzeichnis. Du kannst weiter `git`-Befehle nutzen, mit GitHub arbeiten und im selben Repo zwischen beiden wechseln. jj ist eine andere Bedienoberfläche auf demselben Datenformat.
  - question: Was ist der größte Unterschied zu Git im Alltag?
    answer: Es gibt keinen Staging-Bereich und keinen Stash. Deine Arbeitskopie ist selbst ein Commit, der ständig automatisch aktualisiert wird. Statt `git add` und `git commit` beschreibst du Commits und schiebst Änderungen zwischen ihnen hin und her.
  - question: Kann ich jj im Team einsetzen, wenn die anderen Git nutzen?
    answer: Ja. Weil jj im Hintergrund normale Git-Commits und -Branches erzeugt, sieht dein Team auf GitHub nichts Ungewöhnliches. Du kannst jj allein für dich nutzen, ohne dass es jemanden stört.
---

Ich habe Git nie gehasst. Ich habe nur irgendwann gemerkt, wie viel von meiner mentalen Energie in den Staging-Bereich, in `git stash` und in das Aufräumen verkorkster Rebases fließt. Das ist kein Lernproblem. Ich kann Git. Es ist einfach ein Werkzeug mit viel Zustand, den man im Kopf halten muss.

Jujutsu, kurz jj, räumt mit einem Teil davon auf. Das Projekt liegt bei knapp 30.000 Sternen auf GitHub, wird intern bei Google benutzt und landet regelmäßig auf der Hacker-News-Startseite, weil immer wieder jemand schreibt, dass er nach Jahren von Git weg ist. Das Beste daran: Du musst nichts wegwerfen, um es auszuprobieren. jj setzt sich auf dein vorhandenes Git-Repo.

## Das eine Konzept, das alles erklärt

In Git gibt es Working Directory, Staging Area und Commits. Drei Orte für deinen Code, plus den Stash als vierten Notnagel.

In jj gibt es Commits. Sonst nichts. Deine Arbeitskopie ist selbst ein Commit, der sogenannte Working-Copy-Commit. Jede Änderung, die du am Code machst, wandert automatisch in diesen Commit, ohne `add`, ohne `commit`. Wenn du eine neue Einheit anfangen willst, legst du mit `jj new` einen neuen leeren Commit oben drauf und arbeitest darin weiter.

Klingt erst mal komisch. Nach einem halben Tag fragst du dich, warum Git es je anders gemacht hat.

## Installation

jj bekommst du über die üblichen Paketmanager. Auf dem Mac:

```bash
brew install jj
```

Unter Linux per Cargo, wenn dein Paketmanager es nicht hat:

```bash
cargo install --locked --bin jj jj-cli
```

Danach einmal Name und E-Mail setzen, wie bei Git:

```bash
jj config set --user user.name "Alexander Schneider"
jj config set --user user.email "mail@example.com"
```

## jj auf ein bestehendes Git-Repo legen

Du musst kein neues Repo anfangen. Geh in ein vorhandenes Git-Repo und initialisiere jj daneben:

```bash
jj git init --colocate
```

Das erzeugt ein colocated Repo: Es liegen ein `.jj`- und ein `.git`-Verzeichnis nebeneinander, beide auf demselben Stand. Du kannst weiter `git`-Befehle absetzen, und jj sieht die Änderungen.

Wenn du ein Repo frisch von GitHub holst, geht das direkt mit jj:

```bash
jj git clone https://github.com/dein-name/dein-repo.git
```

Das `git` im Befehl ist Pflicht, jj trennt Git-spezifische Operationen bewusst in einen eigenen Namensraum.

## Der Alltag in fünf Befehlen

Schau dir an, wo du stehst:

```bash
jj st
```

`jj st` ist der Kurzname für `jj status` und zeigt dir die Änderungen im aktuellen Working-Copy-Commit. Du hast nichts gestaged, weil es kein Staging gibt. Was du am Code geändert hast, ist schon drin.

Den aktuellen Commit beschreibst du mit:

```bash
jj describe -m "Login-Validierung gefixt"
```

Wenn diese Einheit fertig ist und du die nächste anfangen willst:

```bash
jj new
```

Jetzt sitzt du auf einem frischen, leeren Commit. Deine vorherige Arbeit ist sicher im beschriebenen Commit darunter.

Den Verlauf siehst du mit:

```bash
jj log
```

Die Ausgabe zeigt die Change-IDs, die du für fast alles brauchst. Eine Change-ID bleibt stabil, auch wenn sich der zugrundeliegende Commit-Hash bei einem Rebase ändert. Das ist einer der Gründe, warum Umbauten in jj so wenig wehtun.

Und wenn du Änderungen aus dem aktuellen Commit in seinen Vorgänger schieben willst:

```bash
jj squash
```

Das ist dein Ersatz für "ach, das gehört eigentlich in den letzten Commit". Kein `commit --amend`, kein interaktiver Rebase. Du schiebst Änderungen einfach nach unten.

## Branches heißen jetzt Bookmarks

Hier stolpern Git-Umsteiger gern. jj hat das Konzept "Branch" umbenannt. Was bei Git ein Branch ist, ist bei jj ein Bookmark. Ein Bookmark ist ein benannter Zeiger auf einen Commit, der sich aber nicht automatisch mitbewegt, wenn du weiterarbeitest.

Ein Bookmark anlegen:

```bash
jj bookmark create feature-login -r @
```

Das `@` steht für deinen aktuellen Commit, `@-` für dessen Vorgänger. Wenn du den Stand nach GitHub bringen willst, brauchst du beim ersten Mal `--allow-new`, weil das Bookmark auf dem Remote noch nicht existiert:

```bash
jj git push --allow-new
```

Und Änderungen vom Remote holst du mit:

```bash
jj git fetch
```

Auf GitHub kommt am Ende ein ganz normaler Git-Branch an. Dein Team merkt nicht, dass du jj benutzt.

## Was mir am ersten Tag aufgefallen ist

Der Moment, der bei mir Klick gemacht hat: Ich habe an zwei Dingen gleichzeitig gearbeitet, sie in den falschen Commit gepackt und das in Git-Manier schon innerlich als verlorene halbe Stunde abgeschrieben. In jj habe ich die Änderung mit einem `jj squash` in den richtigen Commit geschoben und weitergemacht. Kein Stash, kein Cherry-Pick, kein Schweiß.

jj ist nicht magisch. Submodule und Git LFS sind noch raue Kanten, und manche Git-Workflows musst du neu denken. Aber für die tägliche Arbeit an einem Repo nimmt es mir genau den Verwaltungskram ab, der mich an Git gestört hat. Probier es an einem Repo aus, das dir nicht heilig ist. Eine Stunde reicht, um zu merken, ob es für dich klickt.
