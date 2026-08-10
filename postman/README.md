# Postman-Testsuite

End-to-End-Durchlauf aller API-Endpoints des E-Portfolio-Backends in einer
Ausführung: Login zuerst, Tokens und IDs wandern automatisch in Variablen,
jeder Request prüft Statuscode und zentrale Response-Felder. Die Dateien in
diesem Ordner sind die Quelle der Wahrheit; die Kopie im Postman-Workspace
„E-Portfolio HSB" wird daraus aktualisiert.

| Datei | Zweck |
|---|---|
| `E-Portfolio-HSB.postman_collection.json` | Collection (Format v2.1), 98 Requests in 11 Ordnern |
| `Local-Dev.postman_environment.json` | Environment für `http://localhost:8080` |
| `fixtures/test-image.png` | echtes PNG für den Datei-Upload (das Backend prüft die Dateisignatur) |

## Voraussetzungen

1. Postgres läuft (Wurzelverzeichnis):
   `docker compose -f compose.base.yml -f compose.dev.yml up -d db`.
2. Backend läuft im Profil dev: `cd backend && ./mvnw spring-boot:run`.
3. In der `.env` ist `DEV_TEST_PASSWORD` gesetzt; daraus entstehen die drei
   Dev-Testnutzer (`DevTestUserSeeder`), mit denen die Collection arbeitet.
4. Im Environment `Local Dev` den Wert `devTestPassword` auf denselben Wert
   setzen. **Nur lokal setzen, nie committen**: die Datei im Repo enthält
   bewusst einen leeren Platzhalter (Typ secret). Bei Newman stattdessen
   `--env-var` verwenden, siehe unten.

## Lauf im Collection Runner (Postman-App)

1. Workspace „E-Portfolio HSB" öffnen, Collection
   „E-Portfolio Hochschule Bremen: API-Testsuite" auswählen.
2. Für den Datei-Upload einmalig das Working Directory auf diesen Ordner
   stellen: Settings → General → Working directory → `<repo>/postman`.
   Ohne das schlägt genau ein Request fehl („Datei hochladen (PNG)").
3. Environment „Local Dev" wählen und `devTestPassword` als Current value
   eintragen.
4. Auf der Collection „Run" klicken, Reihenfolge unverändert lassen, Run
   starten. Die Ordner bauen aufeinander auf (00 Smoke bis 10 Cleanup).

## Lauf mit Newman im Terminal

Der bequemste Weg führt über das Steuerskript im Wurzelverzeichnis:
`.\eportfolio.ps1`, dann Menüpunkt **t** (kompletter Lauf) bzw. **tc**
(nur der Cleanup-Ordner). Das Skript liest `DEV_TEST_PASSWORD` aus der
`.env`, setzt die `baseUrl` passend zur gewählten Betriebsart (DEV oder
ARTIFACT) und prüft vorher, ob das Backend erreichbar ist.

Von Hand geht es genauso: Newman läuft lokal und ohne Postman-Cloud-Limits,
ist also auch für CI geeignet. Aufruf aus diesem Ordner, damit der relative
Pfad zum Upload-Fixture stimmt:

```bash
cd postman
npx newman@6 run E-Portfolio-HSB.postman_collection.json \
  -e Local-Dev.postman_environment.json \
  --env-var "devTestPassword=<Wert aus .env DEV_TEST_PASSWORD>"
```

Optionaler HTML-Report:

```bash
npx -p newman@6 -p newman-reporter-htmlextra newman run E-Portfolio-HSB.postman_collection.json \
  -e Local-Dev.postman_environment.json \
  --env-var "devTestPassword=..." -r cli,htmlextra
```

Hinweise:

- Newman läuft bei fehlgeschlagenen Assertions **weiter** und erreicht damit
  auch den Cleanup-Ordner; abbrechen beim ersten Fehler nur mit `--bail`.
- Exit-Code ist 0 bei komplett grünem Lauf, sonst ungleich 0 (CI-tauglich).

## Aufräumen und Wiederholbarkeit

Alles, was die Collection anlegt, trägt den Marker `PMTEST` (Titel, Namen)
bzw. `pmtest` (E-Mail-Adressen) und wird im Ordner „10 Cleanup" wieder
entfernt. Eindeutige Felder bekommen einen Zeitstempel, damit wiederholte
Läufe nicht an 409-Konflikten scheitern.

Nach einem **abgebrochenen** Lauf (Strg+C, Backend weg) nur den
Cleanup-Ordner fahren; seine Marker-Sweeps finden und entfernen auch Reste
früherer Läufe:

```bash
npx newman@6 run E-Portfolio-HSB.postman_collection.json \
  -e Local-Dev.postman_environment.json \
  --env-var "devTestPassword=..." --folder "10 Cleanup"
```

Nuklearoption für die lokale Dev-Datenbank:
`docker compose -f compose.base.yml -f compose.dev.yml down -v`, dann
wieder `… up -d db` und das Backend neu starten; Flyway migriert frisch,
die Seeder legen Dev-Nutzer und Stammdaten neu an.

## Bekannte Grenzen

- **Höchstens zwei Volläufe je 15 Minuten.** `POST /auth/verify/resend` und
  `POST /auth/forgot-password` teilen sich serverseitig einen Zähler
  (5 Aufrufe je IP in 15 Minuten, jeder Aufruf zählt). Ein dritter Lauf
  innerhalb des Fensters bekommt dort 429. Abhilfe: kurz warten oder das
  Backend neu starten (der Zähler liegt nur im Arbeitsspeicher).
- **`POST /api/auth/verify` ist nicht enthalten** (einziger Endpoint ohne
  automatisierten Test): der Verifizierungscode steht im dev-Profil nur im
  Serverlog (`app.mail.provider=log`). Manuell testen: registrieren, Code aus
  dem Log kopieren, `POST /api/auth/verify` mit `email`, `purpose`, `code`.
- Die Registrierungs-Requests hinterlassen je Lauf ein unbestätigtes Konto
  (`pmtest-reg-…`); der Cleanup deaktiviert es. Verwaiste Dateien ohne
  Projektbezug haben keinen List-Endpoint und bleiben nach einem Abbruch
  liegen; sie verschwinden mit dem DB-Reset.
- Die Suite ist ein linearer Strang: fällt ein früher Request aus, werden
  Folge-Requests rot, obwohl nur eine Stelle kaputt ist. Sie beantwortet
  „läuft die Kette", nicht „welcher Endpoint genau ist kaputt".

## Export

Entfällt als Handgriff: Collection und Environment liegen als JSON in diesem
Ordner. Änderungen zuerst hier machen (bzw. aus Postman heraus exportieren
und die Dateien ersetzen), dann in den Workspace „E-Portfolio HSB"
hochladen, damit beide Stände gleich bleiben.
