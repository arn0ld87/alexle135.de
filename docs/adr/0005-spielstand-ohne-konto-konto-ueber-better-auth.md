---
status: accepted
---

# Linux-Krimi: Spielstand zuerst ohne Konto, später Konto über Better Auth statt Supabase

Wer spielt, braucht kein Konto. Der Stand liegt wie bisher in `localStorage` und lässt sich zuerst als Spielstand-Code exportieren und auf einem anderen Gerät importieren, ganz ohne personenbezogene Daten. Ein freiwilliges Konto zum Speichern auf dem Server folgt in einem späteren, eigenen Schritt. Es läuft über das vorhandene Better Auth und die Prod-PostgreSQL, nicht über ein selbst gehostetes Supabase im Heimnetz. Den Weg über Supabase haben wir verworfen, weil das Repo bewusst von Supabase auf eigenes Postgres und Better Auth umgezogen ist, weil der Heimnetz-Host aus dem Internet nicht erreichbar ist und das Speichern damit an seiner Verfügbarkeit hinge, und weil ein zweites Auth-System eine zweite Angriffsfläche wäre.

## Consequences

- Wird die Registrierung geöffnet (heute `disableSignUp: true`), bleibt die Admin-Prüfung fail-closed (`adminAuth.ts`, #135). Ein Spielkonto ist nie Admin. Die E-Mail-Allowlist für Admins und die Bestätigung der E-Mail-Adresse werden in der Spec ausdrücklich behandelt.
- Ein Konto bringt DSGVO-Pflichten mit sich: Datenschutzhinweis, Löschen des Kontos und Datensparsamkeit.
