---
name: backend-modul
description: Baut ein Backend-Feature-Modul für das E-Portfolio Hochschule Bremen (DTOs, Service, Controller, Tests) nach API-Contract und Hauskonventionen. Immer verwenden, wenn ein KAN-Ticket neue Endpoints, Services oder DTOs im Spring-Boot-Backend verlangt.
---

# Backend-Modul bauen (Controller bis Service)

Ziel: Jedes Modul entsteht in derselben Reihenfolge, mit denselben
Konventionen und derselben Testtiefe. Stilvorbild ist das `auth`-Paket
(Records, Javadoc mit Warum-Begründungen, Tabs, deutsche Namen). Für
lesende Endpoints ist `project` aus KAN-16 das nähere Vorbild
(`ProjectController`, `ProjectReadService`, `ProjectSpecifications`,
`project/dto`), für einfache Referenzlisten ohne Paginierung `masterdata`
aus KAN-14.

## 0. Vorbereitung (nie überspringen)

1. Jira-Ticket lesen; alle genannten Contract-§§ der Seite
   „Datenmodell & API-Contract" (ID 36732929) nachschlagen, mindestens §5
   (Rechtematrix), §6.1 (Endpoint-Zeilen), §6.2/§6.3 (Fehler).
2. `docs/ARCHITEKTUR.md` §6 („Wo kommt was hin") und das Zielpaket ansehen:
   Welche Entities, Repositories und `may…`-Methoden existieren schon?
   `ProjectPermissionService` deckt die komplette Rechtematrix bereits ab,
   also fast nie neue Berechtigungslogik schreiben, sondern vorhandene
   aufrufen.
3. Prüfen, ob `config/SecurityConfig` den neuen Pfad schon kennt (viele
   PUBLIC-GET-Regeln stehen vorab da). Fehlt eine Regel: ergänzen und im
   Code-Kommentar begründen, wie dort üblich.

## 0b. Klärungsrunde vor der ersten Codezeile (nie überspringen)

Fragen werden **vorher** gestellt, nicht im Abschlussbericht gesammelt
(Regel „Fragen vor der Umsetzung" in `CLAUDE.md`). Nach Schritt 0, vor
Schritt 1:

1. Alle entscheidungsrelevanten Punkte des Tickets sammeln und **in einer
   Runde** über `AskUserQuestion` vorlegen: je Frage zwei bis vier konkrete
   Optionen, die empfohlene zuerst und mit „(Empfohlen)" markiert, jeweils
   mit der fachlichen Folge der Wahl. Danach exakt nach den Antworten bauen.
2. Typische Kandidaten in diesem Backend:
   - Der Contract lässt eine Rechte- oder Sichtbarkeitsfrage offen (§5 deckt
     die Konstellation nicht ab).
   - Ticket und Contract widersprechen sich (Pfad, Statuscode, Feldname).
   - Statuscode-Wahl ist nicht eindeutig ableitbar (404 statt 403 zum
     Verbergen der Existenz, 409 versus 400).
   - Ein neuer Fehlercode wäre nötig; damit hängt ein Contract-Nachtrag daran
     (Skill `api-contract-sync`).
   - Schemaänderung mit mehreren vertretbaren Varianten (neue Spalte versus
     neue Tabelle, Nullability, Löschverhalten).
   - Fachliche Abgrenzung: Was gehört bewusst **nicht** in dieses Ticket.
3. Nicht gefragt wird nach Dingen, die Contract, `docs/ARCHITEKTUR.md` oder
   diese Skills bereits beantworten: DTO-Namen nach Schema `…Request` /
   `…Response`, Paketablage, Testreihenfolge, Envelope-Format. Das entscheidet
   Claude selbst.
4. Taucht **während** der Umsetzung eine neue entscheidungsrelevante Frage
   auf: anhalten, fragen, erst mit der Antwort weiterbauen. Keine Annahme in
   den Code schreiben und die Frage später nachreichen.

## 1. DTOs (`<feature>/dto/`)

- Java-**Records**, Namensschema `…Request` / `…Response`; Listenelemente ggf.
  eigene Records (z. B. `ProjectCardResponse`).
- Bean-Validation direkt am Record (`@NotBlank`, `@Size`, …) mit deutschen
  Meldungen; `@Schema` nur dort, wo Feldbedeutung nicht selbsterklärend ist
  (Vorbild `auth/dto/LoginRequest`).
- Niemals Entities direkt serialisieren. Verbotene Felder in Antworten:
  `passwordHash`, `hsbEmail`, `StoredFile.path`.
- Paginierte Listen immer im `PageResponse`-Format
  `{ inhalt, seite, groesse, gesamtElemente, gesamtSeiten }`. Das Record
  existiert seit KAN-16 als `common/dto/PageResponse<T>`, es wird nicht je
  Feature neu gebaut. Springs `Page` wird nie direkt serialisiert (§6.6).
  Der Controller nimmt einen `Pageable` mit `@PageableDefault`; welche
  Felder sortierbar sind, prüft der Service gegen eine Positivliste
  (Vorbild `ProjectReadService`), sonst sortiert ein `?sort=` über
  beliebige Pfade des Objektmodells.

## 2. Service (`<feature>/<Feature>Service.java`)

- `@Service`; schreibende Methoden `@Transactional`, Lesepfade
  `@Transactional(readOnly = true)`.
- Ablaufmuster je Methode: laden (fehlt → `PROJECT_NOT_FOUND` bzw.
  `RESOURCE_NOT_FOUND`, 404) → Berechtigung über
  `ProjectPermissionService.may…` (nein → 403 `NO_PERMISSION`, bei
  fehlender Anmeldung 401 `NOT_AUTHENTICATED`) → Statusregeln (§4.1,
  sonst 409) → fachliche Validierung (400) → schreiben → DTO zurückgeben.
- **Die Existenz einer Ressource wird nicht hinter einem 404 verborgen**
  (§6.3.1). 404 heißt „gibt es nicht", 403 heißt „gibt es, du darfst nicht",
  401 heißt „gibt es, melde dich an". Der Contract wägt das ausdrücklich ab
  und verwirft die Maskierung: IDs sind UUIDs und nicht erratbar, die
  Semantik bleibt über alle Endpoints gleich, und ein Tippfehler im Client
  bleibt von einem Rechteproblem unterscheidbar. Umgesetzt und getestet in
  KAN-16 (`ProjectReadService.detail`).
- Fehler ausschließlich über Exceptions, die der `GlobalExceptionHandler` in
  das §6.2-Envelope übersetzt. Neuer Fehlercode? → Konstante in
  `ErrorCodes.java` mit Javadoc (Status + Auslöser) **und** Merkposten für
  den Contract (Skill `api-contract-sync`).
- Statusübergänge schreiben immer einen `ProjectStatusHistory`-Eintrag.

## 3. Controller (`<feature>/<Feature>Controller.java`)

- `@RestController` + `@RequestMapping("/api/…")`; dünn, keine Fachlogik,
  nur Parameter binden, Service rufen, Statuscode setzen.
- Statuscodes nach §6.3: 200 (GET/PUT/PATCH), 201 (POST legt an),
  204 (DELETE, Logout).
- Angemeldete:r Benutzer:in über `@AuthenticationPrincipal
  AuthenticatedUser` (kann bei PUBLIC-Pfaden `null` sein; der Service
  behandelt beide Fälle).
- OpenAPI: sparsame `@Operation`/`@Schema` wie im `AuthController`; keine
  verbotenen Felder in angezeigten Schemata.

## 4. Migration (nur falls Schemaänderung)

Skill `flyway-migration` befolgen. Kurzfassung: neue Datei, alte nie
anfassen, benannte Constraints, Spalten müssen exakt zu den Entity-Feldern
passen (`ddl-auto: validate`).

## 5. Tests (`backend/src/test/java/...`, gleiche Paketstruktur)

- Unit-Tests für Service-Logik; `@SpringBootTest`/MockMvc für Endpoints,
  gegen die echte Postgres aus `docker-compose.yml`.
- Pflichtfälle je Endpoint: Happy Path · 401 ohne Token (falls geschützt) ·
  403/404 nach Rechtematrix · 409-Statusregeln · Validierungsfehler 400 im
  Envelope.
- Testdaten über Helfer wie `TestUser`/`TestProject` (wiederverwenden oder im
  selben Stil ergänzen). Alle bestehenden Tests bleiben grün.

## 6. Definition of Done (Checkliste)

- [ ] Klärungsrunde vor dem ersten Code stattgefunden, Umsetzung folgt den
      Antworten
- [ ] **Keine offene Frage übrig**: was am Ende bleibt, sind entschiedene
      Punkte mit Begründung, keine Rückfragen
- [ ] Alle Endpoint-Zeilen des Tickets umgesetzt, Pfade exakt wie §6.1
- [ ] `SecurityConfig` geprüft/ergänzt und begründet
- [ ] ErrorCodes in `ErrorCodes.java` und Contract deckungsgleich
      (bzw. als v-Nachtrag im Jira-Ticket vermerkt)
- [ ] `./mvnw test` komplett grün, `ddl-auto: validate` bestanden
- [ ] Keine neuen Abhängigkeiten ohne Absprache
- [ ] Javadoc, Kommentare und Jira-Text ohne Em-Dash `—`
- [ ] Jira-Kommentar: Abweichungen und getroffene Entscheidungen samt
      Antwort aus der Klärungsrunde. **Kein Nachtrag zum Sollzustand:** was
      sich am Ticketinhalt verschoben hat, wird in der Beschreibung
      nachgezogen (Skill `ticket-refinement`)
- [ ] Kein Commit, kein Push, kein PR durch Claude, stattdessen Übergabeblock
      (Commit-Text, PR-Titel, PR-Beschreibung) nach Skill `uebergabe`
