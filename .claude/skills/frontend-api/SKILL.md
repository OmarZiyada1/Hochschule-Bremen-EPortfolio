---
name: frontend-api
description: Regeln für die Anbindung des React-Frontends an die Backend-API des E-Portfolio Hochschule Bremen (generierte Typen, Fehler-Envelope, 401/403, Paginierung, Optimistic Locking, Autosave). Immer verwenden, bevor ein Request, ein Hook oder eine Fehlerbehandlung im Frontend entsteht.
---

# Frontend an die API anbinden

Dies ist die Stelle, an der Frontend-Fehler still bleiben: ein übersehener
401 zeigt eine leere Seite, ein falsch gelesenes Seitenformat zeigt „keine
Treffer", ein automatisch wiederholter Autosave überschreibt fremde Arbeit.
Deshalb sind die Regeln hier enger als anderswo.

Verbindlich ist der API-Contract (Confluence-Seite 36732929), besonders
§6.2 (Fehlerformat), §6.3.1 (401/403/404), §6.5 (Authentifizierung),
§6.6 (Paginierung), §6.7 (Passwortzwang).

## 1. Typen kommen aus dem Backend, nicht aus dem Kopf

`frontend/src/api/schema.d.ts` wird aus `/v3/api-docs` generiert
(`openapi-typescript`, Dev-Profil) und eingecheckt. Die Datei wird nie von
Hand bearbeitet.

Ein handgeschriebener Response-Typ ist ein Befund, keine Abkürzung: er
weicht spätestens beim zweiten Feldnamen ab, und der Bruch fällt erst zur
Laufzeit auf. Der Contract nennt `/v3/api-docs` ausdrücklich als
autoritative maschinenlesbare Fassung.

Nach jeder Backend-Änderung an DTOs neu generieren und den Diff ansehen.
Ein unerwarteter Diff ist ein Contract-Befund und gehört gemeldet
(Skill `api-contract-sync`).

## 2. Ein Client, ein Fehlertyp

Alle Requests laufen über den Client in `frontend/src/api/client.ts`. Kein
`fetch` in einer Komponente, keinem Hook, keinem Utility daneben.

Aufgerufen wird der Client nur aus den `queryOptions`-Fabriken und
Mutationsfunktionen unter `src/api/queries/<ressource>.ts`: dort stehen
Response-Typ und Query-Key je Serveroperation an genau einer Stelle,
und Feature-Hooks konsumieren die Fabrik, ohne Pfade oder `api.*` zu
kennen (Skill `frontend-modul`, Abschnitt 2). Die Pfade selbst liegen als
Konstanten in `src/api/endpoints.ts` (`apiPaths`, Review zu KAN-8): kein
Pfad-Literal in Fabriken, Mutationsfunktionen oder im Auth-Kontext, dann
hat eine Pfadänderung genau eine Fundstelle. Eine Fabrik und ein
Pfadeintrag entstehen erst mit ihrem ersten Verwender; Einträge ohne
Endpoint in §6.1 sind Befunde.

Jede Fehlerantwort wird in genau einen Typ übersetzt, das Envelope aus §6.2:

```ts
type ApiError = {
  timestamp: string;
  status: number;
  errorCode: string;
  message: string;
  path: string;
};
```

Es gibt keinen Pfad, auf dem eine rohe `Response` oder ein `unknown` in die
Oberfläche gelangt. Auch die von Spring Security erzeugten 401 und 403
liefern dieses Envelope; der Server ist darauf ausdrücklich verdrahtet,
damit der Client nicht zwei Fehlerformate unterscheiden muss.

**Nie den Meldungstext auswerten**, um zu entscheiden, was zu tun ist.
Entschieden wird über `errorCode`. Der `message` des Servers existiert nur
deutsch und dient als Rückfallebene; der angezeigte Text kommt aus i18n.

## 3. Reaktion auf die Fehlercodes, zentral

Diese Zuordnung steht **einmal** im Client, nicht in jedem Hook:

| Fehlercode | Status | Reaktion |
| --- | --- | --- |
| `NOT_AUTHENTICATED`, `TOKEN_INVALID`, `TOKEN_EXPIRED` | 401 | Token verwerfen, sichtbare Meldung, zum Login. Nie eine leere Seite |
| `PASSWORD_CHANGE_REQUIRED` | 403 | zur Passwortseite umleiten (§6.7) |
| `NO_PERMISSION` | 403 | Meldung anzeigen, nicht umleiten |
| `ACCOUNT_NOT_ACTIVE` | 401 | eigene Meldung, kein „falsches Passwort" |
| `TOO_MANY_LOGIN_ATTEMPTS` | 429 | Wartehinweis, kein Wiederholungsversuch |
| `PROJECT_VERSION_CONFLICT` | 409 | **durchreichen**, die aufrufende Stelle entscheidet |
| `VALIDATION_FAILED` | 400 | am betroffenen Formularfeld anzeigen |

Warum 403 zweigeteilt ist: `PASSWORD_CHANGE_REQUIRED` ist ein
Zustand, den die Person selbst auflösen kann, `NO_PERMISSION` nicht.
Der Contract hat dafür bewusst zwei Codes vergeben, damit der Client nicht
aus dem Meldungstext raten muss.

**Feldfehler landen im Formularzustand, nicht in einer Leiste.** Formulare
laufen über `react-hook-form` mit zod-Schema (Skill `frontend-modul`,
Abschnitt 3b). Ein 400 `VALIDATION_FAILED` wird über `setError` dem
betroffenen Feld zugeordnet; der Server nennt es im Meldungsformat
`feld: Text` (§6.2). Was keinem Feld zuzuordnen ist, erscheint als Meldung
am Formular. Das clientseitige zod-Schema macht denselben Fehler schon vor
dem Absenden sichtbar, ersetzt die Serverprüfung aber nicht.

**zod prüft nur Eingaben.** Serverantworten laufen nie durch ein zod-Schema:
ihre Typen kommen aus der generierten `schema.d.ts` (Abschnitt 1), und ein
nachgebautes Antwort-Schema wäre genau der handgeschriebene Response-Typ,
den Abschnitt 1 verbietet.

## 4. Anmeldung: vorausschauend, nicht reaktiv

- `ablaufZeitpunkt` aus der Login-Antwort auswerten und **vor** Ablauf
  sichtbar reagieren. Auf den ersten 401 zu warten heißt, dass ein Request
  mitten in der Arbeit scheitert.
- `passwortAenderungErforderlich` aus Login **und** `GET /auth/me` führen.
  Ist das Flag gesetzt, antwortet der Server auf fast alles mit 403; nur
  `PUT /auth/password`, `GET /auth/me`, `POST /auth/logout` und die beiden
  Rücksetz-Endpoints bleiben erreichbar (§6.7).
- **Rolle und Rechte nie aus dem Token lesen.** Der Server liest beides bei
  jedem Request aus der Datenbank (§6.5); eine Deaktivierung wirkt damit
  sofort. Ein Client, der dem Token glaubt, zeigt einer gesperrten Person
  weiter ihre Oberfläche.
- `POST /auth/logout` antwortet 204 und entwertet das Token serverseitig
  **nicht**. Bei einem stateless JWT ist das nicht möglich. Die Abmeldung
  besteht darin, dass der Client das Token verwirft. Das ist dokumentiertes
  Verhalten und kein Fehler (§6.5).

## 5. Paginierung: `PageResponse<T>`, nicht Springs `Page`

```json
{ "content": [], "page": 0, "size": 20, "totalElements": 137, "totalPages": 7 }
```

Die Feldnamen entsprechen seit v18 denen von Springs `Page`, das Record ist
aber weiterhin ein eigenes (§6.6). Es gibt deshalb **kein** `pageable`,
`sort`, `first`, `last` und `numberOfElements`. Wer eines davon liest,
bekommt `undefined`, ohne dass ein Fehler auftritt.

Der Grund für das eigene Record bleibt: Spring markiert die direkte
Serialisierung von `Page` seit 3.3 als instabil, und ein Antwortformat, das
sich mit einem Framework-Update verschiebt, taugt nicht als gemeinsame
Grundlage zwischen Backend und Frontend.

Weiteres zu `GET /projects`:

- Sortierbar sind nur `title`, `semester`, `status`, `createdAt`,
  `updatedAt`, `publishedAt`. Jedes andere Feld ergibt **400**.
  `reactionCount` ist eine Aggregation und nicht sortierbar.
- Ohne `sort` gilt `updatedAt,desc`.
- `size` ist serverseitig auf 100 gedeckelt und wird **still** gekappt. Die
  tatsächlich verwendete Größe steht als `size` in der Antwort; die UI
  liest sie von dort und nicht aus dem eigenen Request.
- Unbekannte Filter-IDs ergeben eine **leere Liste, keinen 404**. Die UI
  zeigt dafür den Leerzustand und keine Fehlermeldung.
- Stammdaten (`/categories`, `/faculties`, `/study-programs`, `/modules`)
  sind **nicht** paginiert und werden vollständig geladen.

## 6. Optimistic Locking: nie automatisch wiederholen

Jeder schreibende Projekt-Request trägt `version` im Body (§6.4). Bei
**409** `PROJECT_VERSION_CONFLICT` gilt:

1. **Nicht erneut senden.** Ein automatischer Wiederholungsversuch mit der
   neuen Version überschreibt genau die fremde Änderung, vor der das
   Locking schützen soll.
2. Anhalten, den Konflikt sichtbar machen, der Person die Wahl lassen:
   neu laden oder eigene Fassung behalten.
3. TanStack Query entsprechend konfigurieren: für diese Mutationen kein
   `retry`.

## 7. Autosave im Editor

`PUT /projects/{id}/blocks` ersetzt die gesamte Blockliste und antwortet mit
`{ version, blocks }`.

- Die **zurückgegebenen IDs und die neue `version` übernehmen**. Ohne das
  schickt der nächste Takt die Blöcke wieder ohne `id`, der Server legt sie
  neu an, und der Upsert ist wirkungslos. Blockbezogene Kommentare wären
  damit dauerhaft unmöglich.
- Entprellen, nicht bei jedem Tastenanschlag senden.
- Nur ein Autosave gleichzeitig. Zwei überlappende Takte erzeugen
  zuverlässig einen Versionskonflikt gegen sich selbst.
- Speicherzustand sichtbar machen: gespeichert, wird gespeichert, Fehler.
  Ein stiller Fehlschlag im Autosave ist Datenverlust mit Ansage.
- Metadaten laufen über `PUT /projects/{id}`, Inhalt über
  `PUT /projects/{id}/blocks`. Die Trennung ist Absicht (§6.1) und wird im
  Client nicht zusammengefasst.

## 8. Was der Client nicht darf

- **Keine Berechtigungsentscheidung nachbauen.** Sichtbarkeit im UI ist
  Bequemlichkeit, die Prüfung liegt im Server (§5). Eine ausgeblendete
  Schaltfläche ersetzt keine Prüfung, und ein trotzdem eintreffender 403
  wird sichtbar behandelt.
- **Keine serverseitig gefilterten Daten nachfiltern.** Kommentare vom Typ
  `NOTE` erscheinen für Studierende gar nicht erst in der Antwort (§6.1).
  Was der Server liefert, darf angezeigt werden.
- **Keine Provider-Allowlist im Client als Ersatz.** Die Prüfung für
  `VIDEO` und `EMBED` liegt im Server (§2.5); der Client prüft nur für
  die schnelle Rückmeldung.
- **Keine Datei als Base64 ins Dokument.** Uploads gehen an
  `POST /files`, im Blockdokument steht nur `fileId` (§3.15).
- **`hsbEmail` nirgends anzeigen** außer in der Admin-Nutzerverwaltung
  (§3.1). `passwordHash` und `StoredFile.path` verlassen den Server ohnehin
  nie.

## 9. Definition of Done

- [ ] `schema.d.ts` aktuell generiert, kein handgeschriebener Response-Typ
- [ ] Kein `fetch` außerhalb von `frontend/src/api/`
- [ ] `api.*` wird nur aus `src/api/queries/` gerufen; Hooks konsumieren
      die `queryOptions`-Fabriken und bauen keine Keys von Hand nach
- [ ] Jeder Fehler ist ein `ApiError`, Entscheidungen über `errorCode`
- [ ] 401 und 403 sichtbar behandelt, belegt durch je einen Test
- [ ] Listen lesen `content`/`totalPages`, kein Zugriff auf `pageable`,
      `first`, `last` oder `numberOfElements`
- [ ] Keine Mutation mit `retry` auf 409
- [ ] Autosave übernimmt IDs und `version` aus der Antwort
- [ ] 400 `VALIDATION_FAILED` erscheint am betroffenen Feld (`setError`),
      kein zod-Schema über einer Serverantwort
