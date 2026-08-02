# Architektur

Beschreibt den Stand von Branch `main` einschließlich KAN-16
(Projekt-Lese-Endpoints), dessen Merge noch aussteht. Basis-Paket ist
`de.hsbremen.eportfolio`, Gruppen-ID `de.hsbremen`, Artefakt `eportfolio`.

---

## 1. Paketbaum des Backends

Geschnitten wird nach Fachlichkeit (ein Paket je Feature), nicht nach
technischer Schicht. Entity, Repository und Service eines Features liegen im
selben Paket. Die Beschreibungen stammen aus den `package-info.java`-Dateien.

```
de.hsbremen.eportfolio
├── EportfolioApplication          Einstiegspunkt, @SpringBootApplication + @ConfigurationPropertiesScan
├── auth/                          Anmeldung und Ausstellung von Zugriffstokens
│   └── dto/                       (kein eigenes Paket; DTOs liegen in auth/dto)
├── benutzer/                      Benutzerkonten und Profildaten
├── common/
│   ├── domain/                    feature-übergreifende Basisklassen für Entities
│   ├── dto/                       feature-übergreifende DTOs (Seitenformat aus §6.6)
│   ├── enums/                     von mehreren Features genutzte Aufzählungstypen
│   └── error/                     zentrale Fehlerbehandlung, Exceptions, globaler Handler
├── config/                        anwendungsweite Spring-Konfiguration (Security, JPA, Properties)
├── kommentar/                     Kommentare zu Projekten
├── portfolio/                     das E-Portfolio eines Benutzers als Sammlung seiner Projekte
├── projekt/                       einzelne Projektbeiträge inkl. Inhaltsblöcken
│   └── dto/                       DTOs des Projekt-Features (Kachel, Detail, Filter, Teil-DTOs)
├── reaktion/                      Reaktionen/Bewertungen auf Projekte
├── stammdaten/                    Referenzdaten: Fakultät, Studiengang, Modul, Kategorie
│   └── dto/                       DTOs der vier Stammdaten-Endpoints
└── top10/                         Rangliste hervorgehobener Projekte
```

Was in welchem Paket steckt:

| Paket        | Inhalt (Stand `main`) |
|--------------|------------------------|
| `auth`       | `AuthController`, `AuthService`, `JwtService`, `JwtAuthentifizierungsFilter`, `AnmeldeversuchService`, `BenutzerDetailsService`, `AngemeldeterBenutzer`, `RestAuthentifizierungsEinstieg`, `RestZugriffVerweigertHandler`, Properties-Records (`JwtEigenschaften`, `AnmeldeversuchEigenschaften`), `dto/{LoginAnfrage, LoginAntwort, BenutzerAntwort}` |
| `benutzer`   | `User`, `UserRepository`, `DevTestnutzerSeeder` |
| `common.domain` | `BaseEntity`, `AuditableEntity` |
| `common.dto`    | `SeiteAntwort` (Seitenformat aus Contract §6.6) |
| `common.enums`  | `Abschluss`, `BlockTyp`, `KommentarStatus`, `KommentarTyp`, `NominierungStatus`, `ProjektStatus`, `Projekttyp`, `Rolle`, `UserStatus` |
| `common.error`  | `ApiFehler`, `ApiFehlerSchreiber`, `Fehlercodes`, `GlobalExceptionHandler`, `ValidierungException`, `RessourceNichtGefundenException` |
| `config`     | `SecurityConfig`, `JpaConfig`, `OpenApiConfig`, `CorsEigenschaften` |
| `kommentar`  | `Kommentar`, `KommentarRepository` |
| `portfolio`  | `Portfolio`, `PortfolioRepository` |
| `projekt`    | `Projekt`, `Block`, `Projektmitglied`, `ProjektStatusHistorie` + je ein Repository, `BlockValidationService`, `ProjektBerechtigungService`, `BerechtigungEigenschaften`, `ProjektController`, `ProjektLeseService`, `ProjektSpezifikationen`, `dto/{ProjektKachelAntwort, ProjektDetailAntwort, ProjektFilterAnfrage, PersonAntwort, MitgliedAntwort, ReferenzAntwort, BlockAntwort, StatusHistorieAntwort}` |
| `reaktion`   | `Reaktion`, `ReaktionRepository`, `ReaktionAnzahl` (Abfrageergebnis für die Kachelzählung) |
| `stammdaten` | `Fakultaet`, `Kategorie`, `Modul`, `Studiengang` + je ein Repository, `StammdatenController`, `StammdatenService`, `DevStammdatenSeeder`, `dto/{KategorieAntwort, FakultaetAntwort, StudiengangAntwort, ModulAntwort}` |
| `top10`      | `Top10Eintrag`, `Top10Nominierung` + je ein Repository |

---

## 2. Basisklassen

**`common.domain.BaseEntity`** (`@MappedSuperclass`)
Bringt den technischen Primärschlüssel mit: Feld `id` vom Typ `UUID`,
`@GeneratedValue(strategy = GenerationType.UUID)`, nur Getter. Alle Entities
erben davon.

**`common.domain.AuditableEntity`** (`@MappedSuperclass`, erbt `BaseEntity`)
Ergänzt `erstelltAm` und `aktualisiertAm` (beide `Instant`, `not null`),
gepflegt über Spring Data Auditing (`@CreatedDate` / `@LastModifiedDate` +
`AuditingEntityListener`). `erstelltAm` ist `updatable = false`. Aktiviert wird
das Auditing durch `@EnableJpaAuditing` in `config.JpaConfig`.

Wer *nicht* `AuditableEntity` erbt, hat bewusst keine Zeitstempel — bei den
Stammdaten-Tabellen (`kategorie`, `fakultaet`, …) gibt es in den Migrationen
keine Audit-Spalten.

---

## 3. Umsetzungsstand je Entity

„Service" meint einen Service, der diese Entity fachlich bearbeitet, nicht bloß
liest.

| Entity / Feature        | Entity | Migration | Repository | Service | Endpoint |
|-------------------------|:------:|:---------:|:----------:|:-------:|:--------:|
| `User`                  | ✓      | ✓ (1)     | ✓          | teilweise (`BenutzerDetailsService`, `AuthService` — nur Anmeldung) | nur `GET /api/auth/me` |
| `Fakultaet`             | ✓      | ✓ (1)     | ✓          | `StammdatenService` (nur lesend) | ✓ `GET /api/fakultaeten` |
| `Kategorie`             | ✓      | ✓ (1)     | ✓          | `StammdatenService` (nur lesend) | ✓ `GET /api/kategorien` |
| `Studiengang`           | ✓      | ✓ (2)     | ✓          | `StammdatenService` (nur lesend) | ✓ `GET /api/studiengaenge?fakultaet={id}` |
| `Modul`                 | ✓      | ✓ (2)     | ✓          | `StammdatenService` (nur lesend) | ✓ `GET /api/module?studiengang={id}` |
| `Portfolio`             | ✓      | ✓ (2)     | ✓          | —       | — |
| `Projekt`               | ✓      | ✓ (3)     | ✓          | `ProjektBerechtigungService` (Rechteprüfung), `ProjektLeseService` (nur lesend) | ✓ `GET /api/projekte`, `GET /api/projekte/{id}` |
| `Projektmitglied`       | ✓      | ✓ (3)     | ✓          | —       | eingebettet in `GET /api/projekte/{id}` |
| Tags (`projekt_tag`)    | `@ElementCollection` in `Projekt` | ✓ (3) | — | — | eingebettet in beide Projekt-Endpoints |
| Redakteurszuweisung (`projekt_redakteur`) | `@ManyToMany` in `Projekt` | ✓ (3) | — | — | Filter `?redakteur=`, eingebettet in `GET /api/projekte/{id}` |
| `Kommentar`             | ✓      | ✓ (4)     | ✓          | —       | — |
| `Reaktion`              | ✓      | ✓ (4)     | ✓          | —       | nur als `reaktionAnzahl` in den Projekt-Antworten |
| `ProjektStatusHistorie` | ✓      | ✓ (4)     | ✓          | —       | eingebettet in `GET /api/projekte/{id}`, nur für Beteiligte |
| `Top10Eintrag`          | ✓      | ✓ (5)     | ✓          | —       | — |
| `Top10Nominierung`      | ✓      | ✓ (5)     | ✓          | —       | — |
| `Block`                 | ✓      | ✓ (6, 7)  | ✓          | `BlockValidationService` (Validierung, kein CRUD) | eingebettet in `GET /api/projekte/{id}` |
| Auth                    | keine Entity | —   | —          | `AuthService`, `JwtService`, `AnmeldeversuchService` | ✓ `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |

Es gibt drei Controller: `auth.AuthController`, `stammdaten.StammdatenController`
und `projekt.ProjektController` (nur die beiden Lese-Endpoints aus KAN-16).
Datei-Upload, Registrierung, Admin-Bereich, die schreibenden Projekt-Endpoints
und die Top-10-Verwaltung sind noch nicht implementiert. Die Security-Regeln für
einen Teil dieser Pfade stehen bereits in `SecurityConfig` (siehe Abschnitt 5).

Die Stammdaten haben zusätzlich einen `DevStammdatenSeeder` (Profil `dev`,
idempotent): FK1–FK5 mit Beispiel-Studiengängen und -Modulen sowie ein Satz
Kategorien. Ohne diese Daten wären die vier Endpoints leere Listen. Die
Fakultäten entsprechen dem öffentlichen Stand der Hochschule, Studiengänge und
Module sind erfunden — deshalb ein Seeder und keine Migration, die die
Beispieldaten in jede Umgebung tragen würde.

---

## 4. Flyway-Migrationen

Liegen unter `backend/src/main/resources/db/migration`, Namensschema
`V<JJJJMMTTHHMM>__<beschreibung>.sql`. `spring.jpa.hibernate.ddl-auto` steht auf
`validate` — das Schema kommt ausschließlich von Flyway.

| # | Datei | Inhalt |
|---|-------|--------|
| 1 | `V202607221100__stammdaten_und_user.sql` | Tabellen ohne Fremdschlüssel: `app_user` (Login-Kennung ist die private `email`, zusätzlich `hsb_email`; `rolle` und `status` als Check-Constraints), `kategorie`, `fakultaet`. |
| 2 | `V202607221200__studiengang_modul_portfolio.sql` | `studiengang`, `modul`, `portfolio` — Tabellen, die nur auf bereits bestehende verweisen; zwei Fremdschlüssel-Indizes. |
| 3 | `V202607221300__projekt_und_zuordnungen.sql` | Das Projekt-Aggregat: `projekt` plus die Zuordnungstabellen `projekt_tag`, `projekt_redakteur`, `projektmitglied`; Indizes auf allen Fremdschlüsseln und auf `status`. |
| 4 | `V202607221400__kommentar_reaktion_historie.sql` | Am Projekt hängende Tabellen: `kommentar`, `reaktion`, `projekt_status_historie` plus Indizes. |
| 5 | `V202607221500__top10.sql` | `top10_eintrag` und `top10_nominierung`; bewusst **kein** Unique auf `position`, damit Zwischenzustände beim Umsortieren möglich sind. |
| 6 | `V202607221645__block.sql` | `block`: ein Datensatz je Top-Level-Knoten des ProseMirror-Dokuments, `inhalt` als `jsonb`, `typ` als Check-Constraint über die 14 Blocktypen, Unique auf `(projekt_id, reihenfolge)` als `deferrable initially deferred`. |
| 7 | `V202607221800__block_audit_und_schema_version.sql` | Nachtrag zu `block`: Spalte `schema_version` (Default 1) sowie `erstellt_am`/`aktualisiert_am` für die Umstellung auf `AuditableEntity`; die DB-Defaults werden anschließend wieder entfernt, damit JPA sie schreibt. |
| 8 | `V202608011519__projekt_version.sql` | Spalte `projekt.version` (`bigint not null default 0`) für Optimistic Locking nach §3.3/§6.4. Der Default bleibt dauerhaft stehen, damit Inserts aus reinem SQL nicht an der not-null-Bedingung scheitern. |

Aktueller Schemastand laut Flyway: `202608011519`, 8 Migrationen.

---

## 5. Sicherheit

### Ablauf einer Anfrage

1. **Login** — `POST /api/auth/login` mit privater E-Mail und Passwort.
   `AuthService.anmelden` prüft in dieser Reihenfolge:
   Sperre (`AnmeldeversuchService`) → Konto suchen (`findByEmail`) → BCrypt-Vergleich
   → `status == AKTIV`. Bei unbekannter Adresse wird trotzdem gegen einen
   Platzhalter-Hash gerechnet, damit die Antwortzeit keinen Rückschluss auf
   existierende Konten erlaubt. Unbekannte Adresse und falsches Passwort liefern
   dieselbe Meldung und denselben Fehlercode.
2. **Token** — `JwtService.erzeugeToken` signiert mit HS512. Claims: `sub` =
   `userId`, `rolle`, `iss` = `eportfolio`, `iat`, `exp`. Laufzeit 8 Stunden
   (`app.security.jwt.laufzeit`, Default `PT8H`). Bewusst **keine** E-Mail im
   Token — ein JWT ist signiert, nicht verschlüsselt.
3. **Filter** — `JwtAuthentifizierungsFilter` (vor
   `UsernamePasswordAuthenticationFilter`) liest `Authorization: Bearer <token>`.
   Kein Header → die Anfrage läuft ohne `Authentication` weiter (PUBLIC-Fall).
   Header vorhanden, aber Token abgelaufen/ungültig/ohne passendes Konto → sofort
   401 im Fehler-Envelope, statt still anonym weiterzulaufen.
4. **Rolle und Status pro Request aus der DB** — der Filter lädt bei *jeder*
   Anfrage `rolle` und `status` frisch aus `app_user` und verwendet **nicht** den
   Rollen-Claim des Tokens. Ist der Status nicht `AKTIV`, endet die Anfrage mit
   401. Das kostet eine Abfrage pro Request, sperrt ein deaktiviertes Konto aber
   sofort aus, statt erst nach bis zu acht Stunden.
5. **Autorisierung** — zwei Ebenen: `SecurityFilterChain` und
   `@EnableMethodSecurity` decken die Rollenebene ab; die Ressourcenebene („nur
   eigene Ressource") liegt in `ProjektBerechtigungService`, weil sie an den
   Daten hängt (Autor, Projektmitgliedschaft, zugewiesene Redakteur:innen) und
   sich nicht annotieren lässt.

### Weitere Festlegungen in `SecurityConfig`

- **Stateless**: `SessionCreationPolicy.STATELESS`, keine Session, kein Cookie.
- **CSRF aus** — begründet: ohne Cookie gibt es nichts, was der Browser
  automatisch mitschickt. Landet das Token je in einem Cookie, muss CSRF-Schutz
  zurück.
- **CORS**: nur für `/api/**`, erlaubte Origins aus `CORS_ERLAUBTE_ORIGINS`
  (Default `http://localhost:5173`), erlaubte Header nur `Authorization` und
  `Content-Type`, `allowCredentials = false`.
- **Passwörter**: `BCryptPasswordEncoder` mit Spring-Default-Stärke 10.
- **Fehlerformat**: `RestAuthentifizierungsEinstieg` und
  `RestZugriffVerweigertHandler` sorgen dafür, dass auch die von Spring Security
  selbst erzeugten 401/403 im Envelope aus `ApiFehler` (`zeitpunkt`, `status`,
  `fehlercode`, `meldung`, `pfad`) ankommen und die API nicht zwei Fehlerformate
  hat. Denselben Zweck erfüllt im `GlobalExceptionHandler` die Behandlung von
  `MethodArgumentTypeMismatchException`: ein Query-Parameter, der keine UUID
  ist (`?fakultaet=abc`), landete sonst in Springs eigenem Fehlerkörper.

### Offene Pfade und warum

| Pfad | Grund |
|------|-------|
| `OPTIONS /**` | CORS-Preflight muss ohne Token durchgehen. |
| `POST /api/auth/login` | Hier holt man sich das Token erst. |
| `GET /actuator/health` | Health-Check ohne Anmeldung; es ist der einzige freigeschaltete Actuator-Endpoint (`management.endpoints.web.exposure.include: health`). |
| `GET` auf `/api/kategorien`, `/api/fakultaeten`, `/api/studiengaenge`, `/api/module` | PUBLIC-Lesezugriff auf die Stammdaten (§5). Umgesetzt im `StammdatenController`. Hier entscheidet **kein** Berechtigungsservice mit: die Listen hängen an keiner Ressource mit Eigentümer und enthalten nichts Schützenswertes. |
| `GET` auf `/api/projekte`, `/api/projekte/*`, `/api/projekte/*/blocks`, `/api/portfolios/*`, `/api/top10` | PUBLIC-Lesezugriff auf veröffentlichte Inhalte. **Diese Endpoints existieren noch nicht.** Die Regeln stehen vorab da, damit die späteren Controller nicht versehentlich hinter `authenticated()` verschwinden; was ein nicht angemeldeter Aufrufer tatsächlich sieht, entscheidet dann der Berechtigungsservice. |
| `/api/admin/**` | Nicht offen, sondern `hasRole("ADMIN")`. |
| `/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**` | Die Doku ist gerade der Ort, an dem man sich das Token erst besorgt — hinter `authenticated()` wäre sie nutzlos. Im Gegenzug ist springdoc außerhalb des Profils `dev` komplett abgeschaltet, und hinter den Pfaden liegt nur die Beschreibung der API, keine Daten. |

Alles Übrige: `anyRequest().authenticated()`.

### Brute-Force-Bremse

`AnmeldeversuchService` zählt getrennt je E-Mail und je Client-IP; einer der
beiden Zähler reicht für die Sperre. Grenzwerte in `application.yml`:
5 Fehlversuche, 15 Minuten Sperre. Der Zähler liegt **nur im Arbeitsspeicher** —
ein Neustart hebt die Sperre auf, und bei mehreren Instanzen zählt jede für
sich. Als Client-IP wird bewusst `request.getRemoteAddr()` genommen, ohne
`X-Forwarded-For` auszuwerten.

---

## 6. Wo kommt was hin

| Vorhaben | Ort |
|----------|-----|
| Neues Enum, das mehrere Features nutzen | `backend/src/main/java/de/hsbremen/eportfolio/common/enums/` |
| Neue Entity | in das Paket des Features, z. B. `…/projekt/Foo.java`; von `BaseEntity` oder `AuditableEntity` erben |
| Neue Migration | `backend/src/main/resources/db/migration/V<JJJJMMTTHHMM>__<beschreibung>.sql`; bestehende Dateien **nie** ändern |
| Neues Repository | neben die Entity, z. B. `…/projekt/FooRepository.java`, Interface über `JpaRepository` |
| Neuer Service | neben die Entity, z. B. `…/projekt/FooService.java`, `@Service` |
| Neuer Endpoint | `…/<feature>/FooController.java`, `@RestController` mit `@RequestMapping("/api/…")`; Zugriffsregel in `config/SecurityConfig` prüfen |
| Neuer paginierter Endpoint | `Pageable`-Parameter im Controller mit `@PageableDefault`, Antwort als `common/dto/SeiteAntwort<T>` (Contract §6.6); Springs `Page` wird nie direkt serialisiert. Die erlaubten Sortierfelder im Service als Positivliste prüfen, sonst sortiert ein `?sort=autor.passwortHash` über beliebige Pfade des Objektmodells (Vorbild `projekt/ProjektLeseService`) |
| Neuer Listenfilter | Baustein als `Specification<T>` neben die Entity, z. B. `projekt/ProjektSpezifikationen`; die Sichtbarkeitsschranke aus Contract §5 bleibt Startwert der UND-Verknüpfung, damit kein Filter sie aufweichen kann |
| Neues DTO | `…/<feature>/dto/`, z. B. `…/projekt/dto/FooAntwort.java` (dieses Paket existiert bereits, bisher nur mit `package-info.java`); Records mit Bean-Validation-Annotationen wie in `auth/dto/LoginAnfrage`, Abbildung aus der Entity über eine statische `aus(…)`-Methode wie in `stammdaten/dto/StudiengangAntwort` |
| Neuer Fehlercode | Konstante in `common/error/Fehlercodes.java` **und** Zeile in Contract §6.2 (Contract-Version erhöhen, Skill `api-contract-sync`); ein Code an nur einem der beiden Orte ist ein Befund. Siehe Abschnitt 8 |
| Neue Konfigurationswerte | `@ConfigurationProperties`-Record neben das Feature (Vorbild `auth/JwtEigenschaften`), Werte in `application.yml`; Registrierung passiert automatisch über `@ConfigurationPropertiesScan` |
| Neuer Test | `backend/src/test/java/de/hsbremen/eportfolio/<feature>/FooTest.java`, gleiche Paketstruktur wie der Produktivcode; Testdaten-Helfer wie `TestUser`/`TestProjekt`/`TestStammdaten` daneben |

---

## 7. Frontend

Liegt **nicht** in `main`, sondern auf Branch
`KAN-6-Frontend-Projekt-Setup-Design-Tokens-aus-Figma-übernehmen` im Verzeichnis
`frontend/`.

Stand dort: das unveränderte Vite-Startprojekt mit React 19, TypeScript,
Tailwind CSS 4 und shadcn/ui. Enthalten sind `main.tsx`, eine `App.tsx`, die
„Project ready!" und einen Beispiel-Button rendert, ein `theme-provider.tsx`,
die shadcn-Button-Komponente und `lib/utils.ts`. `frontend/README.md` ist die
Template-Datei von shadcn.

Es gibt kein Routing, keinen API-Client, keine Anbindung an das Backend und
keine eigenen Seiten.

Zum Ticketziel „Design-Tokens aus Figma übernehmen": `frontend/src/index.css`
definiert zwar den vollständigen Token-Satz (Farben in `oklch`, Radien,
Schriften), die Farbwerte sind aber die neutralen shadcn-Defaults mit Chroma 0.
Übernommen ist bisher nur die Schrift (Geist Variable) und die abgestufte
Radius-Skala. Ob darüber hinaus Tokens aus Figma gesetzt werden sollten und
welche, ist aus dem Repo nicht ersichtlich — **unklar**.

---

## 8. Fehlerbehandlung

Jede Fehlerantwort verlässt den Server im Envelope aus Contract §6.2
(`common/error/ApiFehler`: `zeitpunkt`, `status`, `fehlercode`, `meldung`,
`pfad`). Es gibt genau zwei Wege dorthin:

- **`common/error/GlobalExceptionHandler`** (`@RestControllerAdvice`) für alles,
  was aus Controllern und Services kommt.
- **`auth/RestAuthentifizierungsEinstieg`** (401) und
  **`auth/RestZugriffVerweigertHandler`** (403) für Fehler, die schon in der
  Security-Filterkette auftreten und den Handler deshalb nie erreichen. Beide
  schreiben über denselben `ApiFehlerSchreiber`, damit das Frontend nicht zwei
  Formate unterscheiden muss.

Fehlercodes stehen als Konstante in `common/error/Fehlercodes.java` **und** als
Zeile in Contract §6.2: beides oder keins.

### Bekannte Einschränkung: Versionskonflikt-Handler

`behandleVersionskonflikt` fängt **jede**
`ObjectOptimisticLockingFailureException` ab und beantwortet sie mit 409
`PROJEKT_VERSION_KONFLIKT`. Das ist heute korrekt, weil `Projekt` die einzige
Entity mit `@Version` ist und §6.2 nur diesen einen Konfliktcode dieser Art
kennt.

**Sobald eine zweite Entity versioniert wird** (etwa `Block`, wenn Blöcke
einzeln gesperrt werden sollen), meldet der Handler für sie den falschen Code.
Dann ist zu tun:

1. In `Fehlercodes` einen eigenen Code für die neue Entity anlegen und ihn nach
   §6.2 nachtragen (Contract-Version erhöhen).
2. Im Handler nach der betroffenen Entity unterscheiden:
   `ObjectOptimisticLockingFailureException.getPersistentClassName()` liefert
   sie. Für einen unbekannten Typ bleibt es beim heutigen Verhalten, damit kein
   Konflikt unbemerkt als 500 durchrutscht.
3. Den Fall in `ProjektVersionskonfliktTest` (oder einem Gegenstück für die neue
   Entity) mit abdecken.

Festgehalten in KAN-15, wo der Handler entstanden ist.
