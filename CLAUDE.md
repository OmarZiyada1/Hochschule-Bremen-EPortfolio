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
   Vor jedem Modul die betroffenen §§ lesen.
2. **Jira**: Projekt `KAN`, verbindlicher Arbeitsstand. `docs/STAND.md` ist
   nur eine Momentaufnahme.
3. **docs/ARCHITEKTUR.md**: Paketbaum, Basisklassen, Migrationsliste,
   Security-Ablauf und die Tabelle „Wo kommt was hin" (§6 dort).
4. **docs/SETUP.md**: Umgebung, `.env`, Testlauf.

Widerspricht der Code dem Contract: **niemals still abweichen.** Entweder den
Code an den Contract anpassen oder die Abweichung nach dem Skill
`api-contract-sync` dokumentieren (neue Contract-Version + Jira-Kommentar).
Jede neue Contract-Version zieht Fundstellen nach sich: Versionsnummer im
Code, in der Doku, in Jira und in Confluence. Welche Stellen das sind und wie
sie gemeldet werden, steht im Skill `api-contract-sync`.

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

## Stack und Repo-Aufbau

- Backend: Spring Boot 3.5.x, Java 21, PostgreSQL 16 (Container), Flyway,
  springdoc-openapi. Basis-Paket `de.hsbremen.eportfolio`, Ordner `backend/`.
- Frontend: Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui (`frontend/`,
  aktuell auf Branch `KAN-6-…`, noch nicht auf `main`).
- Referenzplattform: Portfolio-Portal der HfG Schwäbisch Gmünd.

## Nicht verhandelbare Regeln (Backend)

1. **Bestehende Flyway-Migrationen werden nie geändert.** Neue Migration:
   `V<JJJJMMTTHHMM>__<beschreibung>.sql`. `ddl-auto` bleibt `validate`;
   Details im Skill `flyway-migration`.
2. **Kein Lombok.** Entities mit explizitem Getter/Setter-Minimum; DTOs als
   **Java-Records** mit Bean-Validation und sparsamen `@Schema`-Annotationen
   (Vorbild `auth/dto/LoginAnfrage`).
3. **Deutsche Fachsprache** in Klassen-, Feld- und DTO-Namen: `…Anfrage` /
   `…Antwort`, `Fehlercodes`, `Eigenschaften`-Records. JSON-Felder `camelCase`,
   DB `snake_case`. Einrückung mit Tabs. Javadoc erklärt das *Warum* und
   verweist auf Contract-§§.
4. **Ein Fehlerformat.** Jede Fehlerantwort läuft über das Envelope aus
   Contract §6.2 (`ApiFehler`). Neue Fehlercodes: Konstante in
   `common/error/Fehlercodes.java` **und** Nachtrag in §6.2 (Contract-Version
   erhöhen). Niemals einen Code nur im Code oder nur im Contract führen.
5. **Berechtigungen zweistufig.** Rollenebene über `SecurityFilterChain` /
   Methodensicherheit; Ressourcenebene ausschließlich über
   `projekt/ProjektBerechtigungService` (`darf…`-Methoden). Keine
   Berechtigungslogik in Controllern verstreuen. Neue Endpoints: prüfen, ob
   `config/SecurityConfig` den Pfad korrekt behandelt (viele PUBLIC-GET-Pfade
   stehen dort schon vorab).
6. **Statusregeln serverseitig.** Inhaltsbearbeitung nur in `ENTWURF` /
   `UEBERARBEITUNG` (sonst 409 `PROJEKT_STATUS_NICHT_BEARBEITBAR`);
   Zustandsautomat strikt nach Contract §4.1.
7. **Sensible Felder.** `passwortHash` und `hsbEmail` verlassen den Server in
   keiner Response (Contract §3.1). Keine Secrets im Code: `JWT_SECRET` u. a.
   kommen aus `.env`; es gibt bewusst keine Fallbacks.
8. **Tests sind Teil jedes Tickets.** `./mvnw test` läuft gegen die echte
   Postgres aus `docker-compose.yml` (kein H2, keine Testcontainers).
   Bestehende Tests bleiben grün. Testdaten-Helfer wie `TestUser` /
   `TestProjekt` wiederverwenden bzw. daneben ergänzen.
9. **Keine neuen Abhängigkeiten ohne Rückfrage** und keine Änderungen an
   `docker-compose.yml`, sofern das Ticket es nicht verlangt.

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
   bereits aus Schritt 2 geklärt. `docs/STAND.md` nicht pflegen (veraltet
   bewusst; Jira ist verbindlich).

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
- `.claude/skills/api-contract-sync`: Abgleich Code ↔ Contract, Versionierung
  der Confluence-Seite.
- `.claude/skills/jira-ticket`: Hausstil für neue Tickets.
- `.claude/skills/uebergabe`: Abschluss ohne Push, also Commit-Text, PR-Titel
  und PR-Beschreibung zum manuellen Übernehmen.
- `.claude/agents/backend-modul-builder`: setzt ein Modul-Ticket komplett um.
- `.claude/agents/contract-pruefer`: read-only Abgleich gegen den Contract.
- `.claude/agents/code-reviewer`: Konventions-Review vor dem Merge.

Frontend-Konventionen folgen als eigener Skill, sobald KAN-6/KAN-7 auf `main`
liegen; bis dahin gilt für `frontend/` das jeweilige Ticket.
