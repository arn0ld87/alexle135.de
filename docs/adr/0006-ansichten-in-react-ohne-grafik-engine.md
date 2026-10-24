---
status: accepted
---

# Linux-Krimi: Ansichten in React und SVG, ohne Grafik-Engine

Die Ansichten in Staffel 2, also Räume, Logwand, Netzplan und Aktenwand, bauen wir mit React, HTML und SVG. PixiJS und Phaser setzen wir nicht ein. Die Ansichten bestehen aus Text, Listen und anklickbaren Stellen, und das DOM liefert dafür Barrierefreiheit, Markieren und Kopieren sowie Tests mit Testing Library ohne zusätzlichen Code. Eine Engine würde neben v86 noch einmal etwa 265 KB (Pixi) bis 356 KB (Phaser) gzip laden und eine zweite Zustandswelt mitbringen, und ob sie ohne `unsafe-eval` unter unserer CSP läuft, ist ungeklärt. Freie Figurenbewegung und Physik verzichten wir damit bewusst.
