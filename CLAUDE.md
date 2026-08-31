# E-Portfolio Hochschule Bremen: Projektregeln

Bachelorthesis (Omar Ziyada, Mohamed Alaskari, HSB FK4). Institutionelles
E-Portfolio-Portal mit blockbasiertem Editor und redaktionellem Workflow.
Der Projektname ist **„E-Portfolio Hochschule Bremen"**, niemals „Build Your
Blocks" oder „BYB". Der Admin-Bereich heißt **„Administrationsseite"**, nicht
„Cockpit".

**Wer gemeint ist, wenn ein Mensch gemeint ist.** Diese Regeln und die Skills
gelten für alle, die in diesem Repository mit Claude arbeiten, nicht für eine
bestimmte Person. Wo eine Rückfrage, ein Git-Schritt, eine Freigabe oder ein
Neustart bei einem Menschen liegt, ist immer die Person gemeint, die die
Sitzung führt. Ältere Absätze nennen dafür noch den Namen „Omar"; das ist
dasselbe gemeint und kein Hinweis darauf, dass eine Regel nur für ihn gilt.

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
  **Base UI** (`frontend/`, seit KAN-6 auf `main`; Basiswechsel von Radix
  auf Base UI mit KAN-61). Primitiven entstehen
  ausschließlich über die shadcn-CLI, nie von Hand (Skill `frontend-shadcn`).
  Formulare validieren über `react-hook-form` mit `zod` (Frontend-Regel 12).
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

## Konnektoren prüfen, bevor ein Ticket beginnt

Jira, Confluence und Figma hängen an MCP-Konnektoren. Fallen sie aus (Sitzung
abgelaufen, Konnektor nach einem Update abgemeldet), meldet das niemand von
selbst: es fällt erst auf, wenn die Ticketbeschreibung oder das Template
gebraucht wird, und bis dahin ist womöglich aus dem Gedächtnis gebaut worden.
Deshalb steht die Prüfung ganz vorn, vor jedem Lesen und vor jeder Codezeile.
Drei lesende Aufrufe genügen:

| Konnektor | Prüfaufruf | Erwartete Antwort |
| --- | --- | --- |
| Atlassian (Jira, Confluence) | `mcp__claude_ai_Atlassian_Rovo__atlassianUserInfo` | ein Konto mit `account_status: active` |
| Figma | `mcp__claude_ai_Figma__whoami`, danach `mcp__claude_ai_Figma__get_metadata` auf `o6SECXRMKGOzCfG5xZebPV` | ein Handle mit einem Plan, und danach eine Seitenliste statt einer Zugriffsmeldung |

Geprüft wird, **dass** ein Konto antwortet, nicht welches: die Konten sind je
Entwickler verschieden. Beim Figma-Konnektor sagt `whoami` allein zu wenig. Die
Antwort nennt je nach Entwickler ein beliebiges eigenes Team, und aus einer
fehlenden Teamzeile folgt **nicht**, dass die Projektdatei unlesbar wäre: die
Konten dieses Projekts melden kein gemeinsames Projektteam und können die
Datei trotzdem lesen und schreiben. Der belastbare Test ist deshalb der zweite
Aufruf, ein `get_metadata` auf die Arbeitsdatei `o6SECXRMKGOzCfG5xZebPV`
(nächster Abschnitt). Kommt eine Seitenliste zurück, ist der Konnektor
brauchbar; kommt eine Zugriffsmeldung, ist er es nicht.

Das Ergebnis wird **immer genannt**, auch wenn beides läuft: eine Zeile der
Form „Konnektoren: Atlassian ok, Figma ok" vor dem ersten Arbeitsschritt.
Schweigen liest sich sonst wie „nicht geprüft".

Antwortet ein Aufruf mit Fehler, Zeitüberschreitung oder Anmeldeaufforderung,
**hält Claude an und bittet darum**, den Konnektor in den Einstellungen von
claude.ai neu zu verbinden und danach die IDE (Cursor bzw. VS Code) neu zu
starten. Claude kann die Anmeldung nicht selbst durchführen und startet die
IDE nicht neu. Nach dem Neustart wird die Prüfung wiederholt; erst dann geht
es weiter.

Zwei Feinheiten:

- **Atlassian blockiert immer.** Ohne Jira gibt es keinen Sollzustand, ohne
  Confluence keinen Contract. Ersatzweise aus dem Gedächtnis, aus `docs/` oder
  aus `docs/STAND.md` zu arbeiten ist ausgeschlossen.
- **Figma blockiert Frontend-Tickets.** Ein reines Backend-Ticket darf bei
  ausgefallenem Figma-Konnektor weiterlaufen, aber nur auf ausdrückliche
  Zusage hin, nach der Meldung. Ungefragt wird das nicht entschieden.

Der Contract-Zugriff über `python .claude/skills/api-contract-sync/contract.py`
läuft nicht über MCP, sondern über die REST-API aus `.env.atlassian`, kann also
noch funktionieren, während der Konnektor tot ist. Das ersetzt die Prüfung
nicht: Tickets lesen, kommentieren und Beschreibungen ändern hängt am
Konnektor.

## Die Figma-Arbeitsdatei: Kennung, Seiten, Fallstricke

Der gesamte Prototyp liegt in **einer** Figma-Datei. Ihre Kennung stand bis
jetzt nirgends im Repository, sondern nur auf Confluence-Seiten, und deshalb
war Figma nur über den Umweg Atlassian erreichbar. Ab jetzt steht sie hier:

**File-Key `o6SECXRMKGOzCfG5xZebPV`** („HSB_E-Portfolio"), drei Seiten:

| Seite | Node-ID | Inhalt |
| --- | --- | --- |
| Foundation (veraltet, ersetzen) | `0:1` | Farben, Typografie, Radius, Elevation, dazu die Ergänzungen vom 02.07. und die Nutzungsreferenz vom 06.07. |
| Components | `1:2` | Komponentenbibliothek, je ein `sec:`-Block pro Komponente, Button-Matrix über alle Varianten, Icon-Sammlung |
| Template | `4:611` | 37 Screen-Frames: `Auth / …`, `Template / Öffentlich · …`, `Template / Studierende · …`, `Template / Admin · …`, `Template / Redakteur · …`, `Template / 404` |

Drei Fallstricke, die sonst jedes Mal neu Zeit kosten:

1. **Die Seitenliste ist unvollständig.** `get_metadata` ohne `nodeId` meldet
   reproduzierbar nur `0:1` und `1:2`. Die Seite `Template` fehlt darin,
   obwohl sie mit direkt angegebener ID einwandfrei lesbar ist. Wer „Seiten
   auflisten, dann durchgehen" macht, sieht die Templates also nie und baut
   anschließend doch wieder aus dem Gedächtnis. Deshalb wird `4:611`
   **immer direkt angesteuert**, nie über die Liste gesucht.
2. **Die Template-Seite passt nicht in einen Aufruf.** `get_metadata` auf
   `4:611` liefert rund 372.000 Zeichen und bricht mit „exceeds maximum
   allowed tokens" ab; die Ausgabe landet in einer Datei unter
   `tool-results/`, aus der sich die Frame-Liste mit `grep` holen lässt. Der
   sauberere Weg ist frameweise: Frame-ID des gesuchten Screens nachschlagen
   (Confluence „Template-Abdeckung", Seiten-ID `53739521`, führt sie je
   Template), dann `get_design_context` oder `get_screenshot` auf genau
   diesen Frame. Foundation und Components passen dagegen in je einen Aufruf.
3. **Es gibt eine zweite, falsche Datei.** Die Confluence-Seite „Components"
   (Seiten-ID `28180481`) verlinkt oben `gB1v5Bhd22proZYXTDlJet`
   („HSB E-Portfolio - Design System"). Diese Datei ist mit dem Konnektor
   nicht zugänglich, und die tatsächlich verwendeten Komponenten liegen nicht
   dort. Der Link ist irreführend; maßgeblich ist allein
   `o6SECXRMKGOzCfG5xZebPV`.

## Arbeitsablauf je Ticket

1. **Arbeitsstand und Konnektoren prüfen, bevor irgendetwas entsteht.**
   Zuerst die Konnektoren nach dem Abschnitt „Konnektoren prüfen, bevor ein
   Ticket beginnt", dann der Arbeitsstand: `git fetch` und
   `git status -sb` zeigen, ob der ausgecheckte Branch hinter seinem Remote
   liegt: auf `main` gegen `origin/main`, auf einem Feature-Branch gegen
   dessen Upstream (und gegen `origin/main`, falls der Branch dahinter
   zurückbleibt). Liegt er zurück, wird nicht gebaut, sondern das
   Aktualisieren erbeten: `git pull` ist ein schreibender Befehl und bleibt
   bei Omar. `git fetch` zählt zu den erlaubten lesenden Befehlen, es
   verändert weder Arbeitsverzeichnis noch Historie. Diese Prüfung gilt für
   **jede** Änderung im Repository, auch für Doku und Skills, nicht nur für
   Tickets; sonst entsteht Arbeit auf einem Stand, den der nächste Pull
   wieder wegwirft.
2. Jira-Ticket (KAN-…) vollständig lesen; genannte Contract-§§ nachschlagen.
3. Klärungsrunde nach dem Abschnitt „Fragen vor der Umsetzung": offene Punkte
   gebündelt fragen, Antworten abwarten, erst dann bauen.
4. Skill `backend-modul` befolgen (Reihenfolge, Checklisten, DoD).
5. Branch `KAN-<nr>-<kurzbeschreibung>`; kleine, nachvollziehbare Commits mit
   Ticket-Key im Text. **Angelegt und gesetzt wird von Hand, nicht von
   Claude** (siehe Skill `uebergabe`).
6. Vor Abschluss: kompletter Testlauf, `ddl-auto: validate` grün. Danach
   starten die Prüf-Agents **von selbst**, ohne dass jemand sie anfordert:
   der `contract-pruefer` immer, bei Backend-Änderungen zusätzlich der
   `code-reviewer`, bei Frontend-Änderungen der `frontend-reviewer` (bei
   Tickets über beide Schichten alle drei). Erst wenn deren Befunde behandelt
   oder ausdrücklich vertagt sind, entsteht die Übergabe.
7. Abschluss heißt Übergabe, nicht Push: Skill `uebergabe` befolgen und
   Commit-Text, PR-Titel und PR-Beschreibung ausgeben.
8. Abweichungen und getroffene Entscheidungen ins Jira-Ticket kommentieren,
   nichts stillschweigend entscheiden; offene Fragen sind zu diesem Zeitpunkt
   bereits aus Schritt 3 geklärt. Was den **Sollzustand** eines noch offenen
   Tickets verändert, gehört dagegen in dessen Beschreibung und nicht in den
   Kommentar (Abschnitt „Ein Ticket hat genau einen Sollzustand").
   `docs/STAND.md` nicht pflegen (veraltet bewusst; Jira ist verbindlich).

## Git: Claude schreibt nicht in die Historie

Keine schreibenden Git-/GitHub-Befehle: kein `git add`, `commit`, `push`,
`merge`, `rebase`, `reset`, kein Branch-Anlegen, kein `gh pr create`/`merge`.
Lesende Befehle (`status`, `diff`, `log`, `fetch`) sind erlaubt. Statt zu
committen
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
- `.claude/skills/frontend-shadcn`: shadcn/ui auf Base UI, also Primitiven per
  CLI statt von Hand, `components.json`, Tokenbrücke und was an einer
  generierten Datei geändert werden darf.
- `.claude/skills/thesis-schreiben`: Rezept für die Kapitel der
  Bachelorarbeit, die direkt in den Confluence-Kapitelseiten entstehen:
  Gliederung des unterschriebenen Exposés, Schreibregeln gegen KI-Muster,
  Zitierweise APA 7, Umfangskorridore, Vorgaben des Zweitprüfers, samt
  Werkzeug `thesis.py`
  (`lint`, `umfang`, `korridore`, `storage`, `attach`).
- `.claude/agents/backend-modul-builder`: setzt ein Modul-Ticket komplett um.
- `.claude/agents/frontend-modul-builder`: setzt ein Frontend-Ticket komplett um.
- `.claude/agents/contract-pruefer`: read-only Abgleich gegen den Contract;
  läuft ungefragt bei jedem Ticketabschluss (Arbeitsablauf Schritt 6).
- `.claude/agents/code-reviewer`: Konventions-Review Backend; läuft ungefragt
  nach jeder Backend-Änderung, spätestens vor dem Merge nach `main`.
- `.claude/agents/frontend-reviewer`: Konventions- und
  Barrierefreiheits-Review für `frontend/`; läuft ungefragt nach jeder
  Frontend-Änderung, spätestens vor dem Merge nach `main`.

## Nicht verhandelbare Regeln (Frontend)

Ausführlich in den vier Frontend-Skills; hier nur, was überall gilt.

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
    nachzubauen. Das gilt auch für strukturelle Primitiven ohne
    Interaktion: Zustands- und Meldungsflächen (Leerzustand, 404, Kein
    Zugriff) entstehen aus `empty` bzw. der Domänenhülle `EmptyState`;
    eine fast passende Hülle wird erweitert, nicht umgangen (Befund aus
    KAN-7). Vor jeder Verwendung werden Import und API in der Registry
    nachgeschlagen (`pnpm dlx shadcn@latest view <item>` bzw.
    `docs <item>`), nicht geraten; importiert wird ausschließlich
    aus `@/components/ui/…`, nie direkt aus `@base-ui/react` außerhalb dieses
    Ordners. Einzelheiten im Skill `frontend-shadcn`.

    **Der eine Ausnahmefall: Base UI hat es, die Registry nicht.** Führt die
    Registry zum Stil `base-nova` kein passendes Element, die Basis Base UI
    aber sehr wohl, dann entsteht unter `components/ui/` von Hand eine dünne
    Hülle um die Base-UI-Primitive, und die Domänenkomponente benutzt sie.
    Nachbauen ist auch dann keine Antwort: eine Zusage wie Roving-Tabindex,
    Pfeiltasten oder Fokusfang ist nirgends so vollständig wie in der
    Primitive, und was von Hand entsteht, weicht mit der Zeit ab. Die
    Ausnahme greift nur nach Nachweis, also nach einem `pnpm dlx
    shadcn@latest view <item>`, das mit 404 antwortet; der Nachweis gehört
    als Begründung in den Kopf der Datei. Vorbild:
    `components/ui/toolbar.tsx` (KAN-36).

    **Und ebenso im Umfeld:** Wo eine eingesetzte Bibliothek für ein Problem
    eine offizielle Erweiterung mitbringt, wird sie genommen und nicht
    nachgebaut. Ein Eigenbau daneben ist ein Befund, auch wenn er
    funktioniert. Beispiele aus KAN-36: der Ziehgriff am Block kommt aus
    `@tiptap/extension-drag-handle-react`, der Platzhalter aus
    `@tiptap/extensions`, der Slash-Befehl aus `@tiptap/suggestion`. Bringt
    eine solche Erweiterung weitere Pakete mit, wird das vor der Aufnahme
    genannt und entschieden (Regel 9 im Backend-Teil gilt sinngemäß).
12. **Formulare validieren über `zod`.** Jedes Formular nutzt
    `react-hook-form` mit einem `zod`-Schema (`@hookform/resolvers`);
    handgeschriebene Validierungslogik daneben ist ein Befund. Das Schema
    prüft Eingaben, nie Serverantworten (die Typen kommen aus Regel 2);
    verbindlich bleibt der Server, sein 400 `VALIDATION_FAILED` erscheint am
    betroffenen Feld. Tickets mit Formularanteil nennen die Zod-Validierung
    ausdrücklich (Details im Skill `frontend-modul`).
