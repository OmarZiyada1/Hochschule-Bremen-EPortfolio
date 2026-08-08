# E-Portfolio Hochschule Bremen: Projektregeln

Bachelorthesis (Omar Ziyada, Mohamed Alaskari, HSB FK4). Institutionelles
E-Portfolio-Portal mit blockbasiertem Editor und redaktionellem Workflow.
Der Projektname ist **„E-Portfolio Hochschule Bremen"**, niemals „Build Your
Blocks" oder „BYB". Der Admin-Bereich heißt **„Administrationsseite"**, nicht
„Cockpit".

## Schreibstil: kein Gedankenstrich „—"

Der lange Gedankenstrich (Em-Dash `—`) kommt in **keinem** Text vor, den
Claude schreibt: Jira-Tickets und -Kommentare, Confluence-Seiten,
Markdown-Dateien, Javadoc und Code-Kommentare, Commit- und PR-Texte,
Antworten im Chat. Auch kein Ersatz durch `–` oder ` - ` als Stilmittel.

Stattdessen umformulieren: Doppelpunkt für Erläuterungen, Komma oder
Semikolon für Einschübe, Klammern für Nebenbemerkungen, oder schlicht zwei
Sätze. Bindestriche in Wörtern (`E-Portfolio`, `read-only`) und Listenstriche
am Zeilenanfang sind davon nicht betroffen.

## Verbindliche Quellen (in dieser Reihenfolge)

1. **API-Contract**: Confluence-Seite „Datenmodell & API-Contract"
   (Space BEH, Seiten-ID `36732929`): die einzige Wahrheit für Entities,
   Enums, Rechtematrix (§5), Zustandsautomat (§4) und Endpoints (§6.1).
   Vor jedem Modul die betroffenen §§ lesen, und zwar selbst: gelesen und
   geschrieben wird die Seite über
   `python .claude/skills/api-contract-sync/contract.py` (Zugang aus
   `.env.atlassian`). Die Seite ist zu groß für das MCP-Werkzeug, deshalb
   arbeitet das Skript abschnittsweise auf einer lokalen Arbeitskopie.
2. **Jira**: Projekt `KAN`, verbindlicher Arbeitsstand. `docs/STAND.md` ist
   nur eine Momentaufnahme.
3. **docs/ARCHITEKTUR.md**: Paketbaum, Basisklassen, Migrationsliste,
   Security-Ablauf und die Tabelle „Wo kommt was hin" (§6 dort).
4. **docs/NAMENSSCHEMA.md**: verbindliche Zuordnung Deutsch nach Englisch
   für Klassen, Felder, Enums, Fehlercodes, Endpoints und DB-Spalten.
   Nachschlagen, bevor ein neuer Name entsteht.
5. **docs/SETUP.md**: Umgebung, `.env`, Testlauf.

Widerspricht der Code dem Contract: **niemals still abweichen.** Entweder den
Code an den Contract anpassen oder die Abweichung nach dem Skill
`api-contract-sync` dokumentieren (neue Contract-Version + Jira-Kommentar).
Jede neue Contract-Version zieht Fundstellen nach sich: Versionsnummer im
Code, in der Doku, in Jira und in Confluence. **Diese Nachführung erledigt
Claude vollständig selbst**, also Confluence-Seite, Jira-Beschreibungen und
Jira-Kommentare, und meldet sie anschließend als Tabelle „alt → neu". Nicht
gefragt wird nach Seitentext, Versionsnummern oder Handgriffen; gefragt wird
allein nach fachlichen Entscheidungen (Abschnitt „Fragen vor der Umsetzung").
Beim Menschen bleiben nur die Git-Schritte aus dem Übergabeblock. Welche
Stellen das sind und wie sie gemeldet werden, steht im Skill
`api-contract-sync`.

## Fragen vor der Umsetzung, nicht danach

Offene Fragen gehören an den Anfang eines Tickets, nicht in den
Abschlussbericht. Am Ende einer Änderung steht keine Frage mehr offen.

1. **Klärungsrunde zuerst.** Ticket und die genannten Contract-§§ lesen, den
   betroffenen Code ansehen, dann die entscheidungsrelevanten Fragen
   gebündelt in **einer** Runde stellen (Werkzeug `AskUserQuestion`, je Frage
   zwei bis vier konkrete Optionen, die empfohlene zuerst und als
   „(Empfohlen)" gekennzeichnet). Erst nach den Antworten wird gebaut.
2. **Entscheidungsrelevant** heißt: zwei vertretbare Lesarten führen zu
   anderem Code, Schema, Verhalten, Statuscode oder Fehlercode. Routinefragen
   (Namensdetails, Testaufbau, Paketablage, Reihenfolge) entscheidet Claude
   selbst nach Contract, `docs/ARCHITEKTUR.md` und den Skills, ohne zu fragen.
3. **Frage mitten in der Umsetzung: sofort anhalten und fragen.** Nicht mit
   einer stillen Annahme weiterbauen und die Frage später nachreichen.
4. **Am Ende** nennen Übergabeblock und Jira-Kommentar die getroffenen
   Entscheidungen mit Begründung, aber keine ungeklärten Punkte. Vertagt Omar
   eine Antwort ausdrücklich, steht der Punkt als benannter offener Punkt mit
   Jira-Bezug da, nie als unmarkierte Annahme im Code.

## Ein Ticket hat genau einen Sollzustand: die Beschreibung

Was ein Ticket verlangt, steht in seiner **Beschreibung**, vollständig und
aktuell. Wer es zur Umsetzung öffnet, liest oben und ist unten fertig.

Verschiebt sich daran etwas, bevor das Ticket erledigt ist (ein Endpoint heißt
anders, ein Fehlercode kommt hinzu, ein Blocker wird erkannt, eine Frage ist
entschieden), wird **die Beschreibung überarbeitet**. Ein Kommentar
„Nachtrag: …" ist dafür nie der richtige Ort: Er steht unter dem Text, den er
korrigieren soll, und wird beim Bauen übersehen. Der Ablauf steht im Skill
`ticket-refinement`; die Historie geht nicht verloren, Jira führt die
Versionshistorie der Beschreibung selbst.

Im Kommentarbereich stehen genau zwei Dinge:

1. der **Übergabekommentar** nach der Umsetzung, also Ergebnis und getroffene
   Entscheidungen (Skill `uebergabe`),
2. das **Veröffentlichungsprotokoll** einer neuen Contract-Version, und zwar
   nur am auslösenden Ticket (Skill `api-contract-sync`).

Findet sich in einem offenen Ticket ein alter Nachtrag-Kommentar, wird er bei
der nächsten Berührung aufgelöst: Inhalt in die Beschreibung, danach den
Kommentar mit ID und Link zum Löschen melden. **Claude löscht keine
Jira-Kommentare**, das Werkzeug kann sie nur anlegen und ändern.

## Stack und Repo-Aufbau

- Backend: Spring Boot 3.5.x, Java 21, PostgreSQL 16 (Container), Flyway,
  springdoc-openapi. Basis-Paket `de.hsbremen.eportfolio`, Ordner `backend/`.
- Frontend: Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui auf
  **Radix UI** (`frontend/`, aktuell auf Branch `KAN-6`, noch nicht auf
  `main`). Primitiven entstehen ausschließlich über die shadcn-CLI, nie von
  Hand (Skill `frontend-shadcn`).
- Referenzplattform: Portfolio-Portal der HfG Schwäbisch Gmünd.

## Nicht verhandelbare Regeln (Backend)

1. **Bestehende Flyway-Migrationen werden nie geändert.** Neue Migration:
   `V<JJJJMMTTHHMM>__<beschreibung>.sql`. `ddl-auto` bleibt `validate`;
   Details im Skill `flyway-migration`.
2. **Kein Lombok.** Entities mit explizitem Getter/Setter-Minimum; DTOs als
   **Java-Records** mit Bean-Validation und sparsamen `@Schema`-Annotationen
   (Vorbild `auth/dto/LoginRequest`).
3. **Englische Bezeichner** in Klassen-, Feld- und DTO-Namen: `…Request` /
   `…Response`, `ErrorCodes`, `…Properties`-Records. JSON-Felder `camelCase`,
   DB `snake_case`, beides englisch. Verbindliche Zuordnung Deutsch nach
   Englisch: `docs/NAMENSSCHEMA.md`. **Die Prosa bleibt deutsch:** Javadoc,
   Kommentare, Commit-Texte, Doku und Jira. Einrückung mit Tabs. Javadoc
   erklärt das *Warum* und verweist auf Contract-§§.
4. **Ein Fehlerformat.** Jede Fehlerantwort läuft über das Envelope aus
   Contract §6.2 (`ApiError`). Neue Fehlercodes: Konstante in
   `common/error/ErrorCodes.java` **und** Nachtrag in §6.2 (Contract-Version
   erhöhen). Niemals einen Code nur im Code oder nur im Contract führen.
5. **Berechtigungen zweistufig.** Rollenebene über `SecurityFilterChain` /
   Methodensicherheit; Ressourcenebene ausschließlich über
   `project/ProjectPermissionService` (`may…`-Methoden). Keine
   Berechtigungslogik in Controllern verstreuen. Neue Endpoints: prüfen, ob
   `config/SecurityConfig` den Pfad korrekt behandelt (viele PUBLIC-GET-Pfade
   stehen dort schon vorab).
6. **Statusregeln serverseitig.** Inhaltsbearbeitung nur in `DRAFT` /
   `REVISION` (sonst 409 `PROJECT_STATUS_NOT_EDITABLE`);
   Zustandsautomat strikt nach Contract §4.1.
7. **Sensible Felder.** `passwordHash` und `hsbEmail` verlassen den Server in
   keiner Response (Contract §3.1). Keine Secrets im Code: `JWT_SECRET` u. a.
   kommen aus `.env`; es gibt bewusst keine Fallbacks.
8. **Tests sind Teil jedes Tickets.** `./mvnw test` läuft gegen die echte
   Postgres aus den `compose.*.yml` (kein H2, keine Testcontainers).
   Bestehende Tests bleiben grün. Testdaten-Helfer wie `TestUser` /
   `TestProject` wiederverwenden bzw. daneben ergänzen.
9. **Keine neuen Abhängigkeiten ohne Rückfrage** und keine Änderungen an
   den `compose.*.yml`, sofern das Ticket es nicht verlangt.

## Befehle

```bash
docker compose up -d          # Postgres 16 starten (Wurzelverzeichnis)
cd backend && ./mvnw test     # alle Tests (braucht laufende DB + .env)
cd backend && ./mvnw spring-boot:run   # Start im Profil dev
# Swagger-UI (nur dev): http://localhost:8080/swagger-ui.html
# Dev-Login: dev-studi@dev.invalid / test1234 (siehe DevTestnutzerSeeder)
```

## Arbeitsablauf je Ticket

1. Jira-Ticket (KAN-…) vollständig lesen; genannte Contract-§§ nachschlagen.
2. Klärungsrunde nach dem Abschnitt „Fragen vor der Umsetzung": offene Punkte
   gebündelt fragen, Antworten abwarten, erst dann bauen.
3. Skill `backend-modul` befolgen (Reihenfolge, Checklisten, DoD).
4. Branch `KAN-<nr>-<kurzbeschreibung>`; kleine, nachvollziehbare Commits mit
   Ticket-Key im Text. **Angelegt und gesetzt wird von Hand, nicht von
   Claude** (siehe Skill `uebergabe`).
5. Vor Abschluss: kompletter Testlauf, `ddl-auto: validate` grün, Abgleich mit
   dem Agent `contract-pruefer`.
6. Abschluss heißt Übergabe, nicht Push: Skill `uebergabe` befolgen und
   Commit-Text, PR-Titel und PR-Beschreibung ausgeben.
7. Abweichungen und getroffene Entscheidungen ins Jira-Ticket kommentieren,
   nichts stillschweigend entscheiden; offene Fragen sind zu diesem Zeitpunkt
   bereits aus Schritt 2 geklärt. Was den **Sollzustand** eines noch offenen
   Tickets verändert, gehört dagegen in dessen Beschreibung und nicht in den
   Kommentar (Abschnitt „Ein Ticket hat genau einen Sollzustand").
   `docs/STAND.md` nicht pflegen (veraltet bewusst; Jira ist verbindlich).

## Git: Claude schreibt nicht in die Historie

Keine schreibenden Git-/GitHub-Befehle: kein `git add`, `commit`, `push`,
`merge`, `rebase`, `reset`, kein Branch-Anlegen, kein `gh pr create`/`merge`.
Lesende Befehle (`status`, `diff`, `log`) sind erlaubt. Statt zu committen
liefert Claude am Ende den Übergabeblock aus dem Skill `uebergabe`; Omar
übernimmt ihn manuell. Ausnahme nur auf ausdrückliche Einzelaufforderung in
derselben Nachricht, und dann exakt dieser eine Befehl.

## Skills und Agents

- `.claude/skills/backend-modul`: Rezept für jedes neue Backend-Modul
  (Controller bis Service), inkl. DoD-Checkliste.
- `.claude/skills/flyway-migration`: Regeln für Schemaänderungen.
- `.claude/skills/api-contract-sync` samt Werkzeug `contract.py`: Abgleich
  Code ↔ Contract, Lesen und Veröffentlichen der Contract-Seite, Versionierung
  der Confluence-Seite.
- `.claude/skills/jira-ticket`: Hausstil für neue Tickets.
- `.claude/skills/ticket-refinement`: Abgleich bestehender Tickets gegen
  Repo-Stand und Contract. Refinement wird **in die Beschreibung
  geschrieben**, nie als Kommentar; der Kommentarbereich bleibt dem
  Übergabekommentar vorbehalten.
- `.claude/skills/uebergabe`: Abschluss ohne Push, also Commit-Text, PR-Titel
  und PR-Beschreibung zum manuellen Übernehmen.
- `.claude/skills/frontend-modul`: Rezept für jede neue Seite oder Ansicht
  (Typen bis Route), inkl. DoD-Checkliste.
- `.claude/skills/frontend-api`: Anbindung an die API, also generierte Typen,
  Fehler-Envelope, 401/403, Seitenformat, Optimistic Locking, Autosave.
- `.claude/skills/frontend-design`: Design-Tokens, Komponentenbibliothek,
  Beschriftungen, Barrierefreiheit nach WCAG 2.2.
- `.claude/skills/frontend-shadcn`: shadcn/ui auf Radix, also Primitiven per
  CLI statt von Hand, `components.json`, Tokenbrücke und was an einer
  generierten Datei geändert werden darf.
- `.claude/agents/backend-modul-builder`: setzt ein Modul-Ticket komplett um.
- `.claude/agents/frontend-modul-builder`: setzt ein Frontend-Ticket komplett um.
- `.claude/agents/contract-pruefer`: read-only Abgleich gegen den Contract.
- `.claude/agents/code-reviewer`: Konventions-Review Backend vor dem Merge.
- `.claude/agents/frontend-reviewer`: Konventions- und
  Barrierefreiheits-Review für `frontend/`.

## Nicht verhandelbare Regeln (Frontend)

Ausführlich in den drei Frontend-Skills; hier nur, was überall gilt.

1. **Zwei Vorlagen je Ticket.** Die Confluence-Template-Seite unter
   „Figma-Prototype (Embed)" sagt, *was* auf der Seite steht; der
   API-Contract sagt, *welche Daten* es gibt und wer sie sehen darf.
   Widersprechen sie sich, ist das eine Entscheidung und keine
   Umsetzungsfrage (Abschnitt „Fragen vor der Umsetzung").
2. **Response-Typen werden generiert**, nicht geschrieben: aus
   `/v3/api-docs` nach `frontend/src/api/schema.d.ts`.
3. **Ein Client, ein Fehlertyp.** Kein `fetch` außerhalb von
   `frontend/src/api/`; jede Fehlerantwort wird zum `ApiError` aus §6.2
   (`timestamp`, `status`, `errorCode`, `message`, `path`), und entschieden
   wird über `errorCode`, nie über den Meldungstext.
4. **401 und 403 sind sichtbar**, nie eine leere Seite. Bei 409
   `PROJECT_VERSION_CONFLICT` wird nie automatisch wiederholt.
5. **Farben stehen genau einmal**, in `frontend/src/styles/tokens/`. Eine
   Hex-Farbe daneben ist ein Befund.
6. **Namen englisch**, wie im ganzen Projekt: `ProjectCard`, `StatusBadge`,
   `useProjectList` (`docs/NAMENSSCHEMA.md`). Contract-Enums laufen
   unverändert durch den Code und werden nur für die Anzeige übersetzt.
7. **Kein Oberflächentext im Code.** Jeder sichtbare Text kommt aus i18n
   (`react-i18next`, Deutsch und Englisch gepflegt, Deutsch als Standard).
   Enum-Anzeige über Schlüssel der Form `project.status.PUBLISHED`.
8. **Barrierefreiheit ist Teil des Tickets**, nicht der Nacharbeit: Tastatur,
   sichtbarer Fokus, Labels, Überschriftenhierarchie, Kontrast in hell und
   dunkel (§2.5 beruft sich auf WCAG 2.2).
9. **Tests sind Teil jedes Tickets** (Vitest, Testing Library, MSW), analog
   zur Backend-Regel 8.
10. **Keine Attrappe im ausgelieferten Code.** Fehlt der Endpoint, wird die
    Ansicht nicht gebaut, sondern das blockierende Backend-Ticket benannt.
11. **Primitiven kommen aus der CLI, nicht aus der Hand.** Alles unter
    `frontend/src/components/ui/` entsteht über
    `pnpm dlx shadcn@latest add <name>`; eine dort von Hand angelegte oder
    inhaltlich geänderte Datei ist ein Befund. Von Hand entsteht nur, was
    Domänenwissen trägt, und das komponiert die Primitiven, statt sie
    nachzubauen. Einzelheiten im Skill `frontend-shadcn`.
