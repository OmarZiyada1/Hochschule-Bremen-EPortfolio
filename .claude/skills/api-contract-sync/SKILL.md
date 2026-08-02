---
name: api-contract-sync
description: Abgleich zwischen Backend-Code und der Confluence-Seite „Datenmodell & API-Contract" (Seiten-ID 36732929) für das E-Portfolio Hochschule Bremen. Verwenden, wenn eine Abweichung auffällt, ein neuer Fehlercode/Endpoint entsteht oder ein Modul abgeschlossen wird.
---

# Code ↔ API-Contract synchron halten

Der Contract (Space BEH, Seiten-ID `36732929`, aktuell v11) ist die
verbindliche gemeinsame Grundlage von Backend und Frontend. Er ist nur dann
etwas wert, wenn er stimmt; deshalb wird **jede** Abweichung behandelt, keine
still hingenommen.

## Entscheidungsbaum bei einer Abweichung

1. **Code ist falsch, Contract richtig** (Regelfall): Code anpassen.
2. **Contract ist lückenhaft oder überholt**: Contract in einer neuen
   Version ergänzen (siehe unten), erst dann den Code bauen.
3. **Fachlich unklar** (z. B. Berechtigungsfrage): als offenen Punkt in §7
   des Contracts und auf der Seite „Offene Fragen" (ID 1802249) erfassen,
   Default-Annahme dokumentieren, konfigurierbar umsetzen (Vorbild
   `app.berechtigung.*`).

## Contract-Version erhöhen (Confluence)

1. Seite 36732929 vollständig laden: das Update-Werkzeug ersetzt den
   **gesamten** Seiteninhalt; es wird immer der komplette, ergänzte Text
   zurückgeschrieben.
2. **Bestehenden Inhalt nie löschen oder umformulieren**, nur ergänzen und
   präzisieren; Widersprüche über Hinweiskästen auflösen (so arbeiten v9 bis
   v11).
3. Kopfbereich: neue Versionsnummer; unten in der „Änderungshistorie
   (fachlich)" einen Eintrag im Stil der bestehenden ergänzen:
   betroffene §§, was, warum.
4. Versionskommentar beim Speichern: `v<N>: <Kurzfassung> (KAN-<Ticket>)`.
5. Im zugehörigen Jira-Ticket kommentieren, dass v<N> veröffentlicht ist.
6. Neu geschriebene Absätze ohne Em-Dash `—` formulieren (Schreibstil-Regel
   aus `CLAUDE.md`); bestehender Seitentext bleibt unangetastet.

## Fehlercodes (häufigster Sync-Fall)

Ein Fehlercode existiert erst, wenn er an **beiden** Orten steht:

- Konstante in `common/error/Fehlercodes.java` mit Javadoc
  (HTTP-Status + Auslöser),
- Zeile in Contract §6.2 (und ggf. §6.3, falls neuer Statuscode).

Beim Modul-Abschluss `Fehlercodes.java` gegen §6.2 diffen; jede einseitige
Konstante ist ein Befund.

## Endpoint-Abgleich beim Modul-Abschluss

Für jede Endpoint-Zeile des Moduls in §6.1 prüfen: Pfad · Methode ·
Rollenspalte (gegen `SecurityConfig` + `darf…`-Aufruf) · Statuscodes ·
Body-/Response-Form. Die maschinenlesbare Fassung ist `/v3/api-docs`
(springdoc, Profil dev); es gibt bewusst keine gepflegte `openapi.yaml`
im Repo.

## Definition of Done

- [ ] Abweichung klassifiziert (Code-Fehler / Contract-Lücke / offene Frage)
- [ ] Contract-Version veröffentlicht mit Historieneintrag, nichts gelöscht
- [ ] `Fehlercodes.java` ↔ §6.2 deckungsgleich
- [ ] Jira-Ticket kommentiert
- [ ] Code-Änderungen daraus gehen über den Übergabeblock (Skill `uebergabe`),
      nicht über einen Commit von Claude
