---
title: Repo-Hygiene gegen generierte Artefakte
summary: Ein lokaler Hygiene-Check verhindert, dass Testberichte, Scratch-Verzeichnisse und Root-Reports wieder im Hauptzweig landen.
type: operations
publishedAt: 2026-07-02
links: []
---

Generierte Artefakte gehoeren in CI-Uploads oder lokale Arbeitsverzeichnisse,
nicht in den App-Quellstand. Der neue Check macht diesen Anspruch maschinell
pruefbar.
