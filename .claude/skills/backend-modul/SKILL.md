---
name: backend-modul
description: Baut ein Backend-Feature-Modul für das E-Portfolio Hochschule Bremen (DTOs, Service, Controller, Tests) nach API-Contract und Hauskonventionen. Immer verwenden, wenn ein KAN-Ticket neue Endpoints, Services oder DTOs im Spring-Boot-Backend verlangt.
---

# Backend-Modul bauen (Controller bis Service)

Ziel: Jedes Modul entsteht in derselben Reihenfolge, mit denselben
Konventionen und derselben Testtiefe. Vorbild für alles ist das `auth`-Paket —
der einzige bislang vollständige vertikale Schnitt.

## 0. Vorbereitung (nie überspringen)

1. Jira-Ticket lesen; alle genannten Contract-§§ der Seite
   „Datenmodell & API-Contract" (ID 36732929) nachschlagen — mindestens §5
   (Rechtematrix), §6.1 (Endpoint-Zeilen), §6.2/§6.3 (Fehler).
2. `docs/ARCHITEKTUR.md` §6 („Wo kommt was hin") und das Zielpaket ansehen:
   Welche Entities, Repositories und `darf…`-Methoden existieren schon?
   `ProjektBerechtigungService` deckt die komplette Rechtematrix bereits ab —
   fast nie neue Berechtigungslogik schreiben, sondern vorhandene aufrufen.
3. Prüfen, ob `config/SecurityConfig` den neuen Pfad schon kennt (viele
   PUBLIC-GET-Regeln stehen vorab da). Fehlt eine Regel → ergänzen und im
   Code-Kommentar begründen, wie dort üblich.

## 1. DTOs (`<feature>/dto/`)

- Java-**Records**, Namensschema `…Anfrage` / `…Antwort`; Listenelemente ggf.
  eigene Records (z. B. `ProjektKachelAntwort`).
- Bean-Validation direkt am Record (`@NotBlank`, `@Size`, …) mit deutschen
  Meldungen; `@Schema` nur dort, wo Feldbedeutung nicht selbsterklärend ist
  (Vorbild `auth/dto/LoginAnfrage`).
- Niemals Entities direkt serialisieren. Verbotene Felder in Antworten:
  `passwortHash`, `hsbEmail`, `Datei.pfad`.
- Paginierte Listen immer im `SeiteAntwort`-Format
  `{ inhalt, seite, groesse, gesamtElemente, gesamtSeiten }`.

## 2. Service (`<feature>/<Feature>Service.java`)

- `@Service`; schreibende Methoden `@Transactional`, Lesepfade
  `@Transactional(readOnly = true)`.
- Ablaufmuster je Methode: laden (fehlt → `PROJEKT_NICHT_GEFUNDEN` bzw.
  `RESSOURCE_NICHT_GEFUNDEN`, 404) → Berechtigung über
  `ProjektBerechtigungService.darf…` (nein → 403 `KEINE_BERECHTIGUNG`;
  bei Projekten ohne Leserecht stattdessen 404, Existenz nicht leaken) →
  Statusregeln (§4.1, sonst 409) → fachliche Validierung (400) → schreiben →
  DTO zurückgeben.
- Fehler ausschließlich über Exceptions, die der `GlobalExceptionHandler` in
  das §6.2-Envelope übersetzt. Neuer Fehlercode? → Konstante in
  `Fehlercodes.java` mit Javadoc (Status + Auslöser) **und** Merkposten für
  den Contract (Skill `api-contract-sync`).
- Statusübergänge schreiben immer einen `ProjektStatusHistorie`-Eintrag.

## 3. Controller (`<feature>/<Feature>Controller.java`)

- `@RestController` + `@RequestMapping("/api/…")`; dünn — keine Fachlogik,
  nur Parameter binden, Service rufen, Statuscode setzen.
- Statuscodes nach §6.3: 200 (GET/PUT/PATCH), 201 (POST legt an),
  204 (DELETE, Logout).
- Angemeldete:r Benutzer:in über `@AuthenticationPrincipal
  AngemeldeterBenutzer` (kann bei PUBLIC-Pfaden `null` sein — der Service
  behandelt beide Fälle).
- OpenAPI: sparsame `@Operation`/`@Schema` wie im `AuthController`; keine
  verbotenen Felder in angezeigten Schemata.

## 4. Migration (nur falls Schemaänderung)

Skill `flyway-migration` befolgen. Kurzfassung: neue Datei, alte nie
anfassen, benannte Constraints, Spalten müssen exakt zu den Entity-Feldern
passen (`ddl-auto: validate`).

## 5. Tests (`backend/src/test/java/...`, gleiche Paketstruktur)

- Unit-Tests für Service-Logik; `@SpringBootTest`/MockMvc für Endpoints —
  gegen die echte Postgres aus `docker-compose.yml`.
- Pflichtfälle je Endpoint: Happy Path · 401 ohne Token (falls geschützt) ·
  403/404 nach Rechtematrix · 409-Statusregeln · Validierungsfehler 400 im
  Envelope.
- Testdaten über Helfer wie `TestUser`/`TestProjekt` (wiederverwenden oder im
  selben Stil ergänzen). Alle bestehenden Tests bleiben grün.

## 6. Definition of Done (Checkliste)

- [ ] Alle Endpoint-Zeilen des Tickets umgesetzt, Pfade exakt wie §6.1
- [ ] `SecurityConfig` geprüft/ergänzt und begründet
- [ ] Fehlercodes in `Fehlercodes.java` und Contract deckungsgleich
      (bzw. als v-Nachtrag im Jira-Ticket vermerkt)
- [ ] `./mvnw test` komplett grün, `ddl-auto: validate` bestanden
- [ ] Keine neuen Abhängigkeiten ohne Absprache
- [ ] Jira-Kommentar: Annahmen, Abweichungen, offene Fragen
- [ ] Kein Commit, kein Push, kein PR durch Claude — stattdessen Übergabeblock
      (Commit-Text, PR-Titel, PR-Beschreibung) nach Skill `uebergabe`
