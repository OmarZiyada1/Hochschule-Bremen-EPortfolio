# E-Portfolio-Portal der Hochschule Bremen (FK4)

Praktischer Teil einer Bachelorthesis an der Hochschule Bremen, Fakultät 4.
Das System soll Studierenden erlauben, Projektarbeiten als E-Portfolio zu
veröffentlichen; Redakteur:innen geben Beiträge frei, eine Top-10-Liste hebt
ausgewählte Projekte hervor. Umgesetzt wird ein Spring-Boot-Backend mit
PostgreSQL und ein React-Frontend. Der Stand ist ein früher Prototyp: das
Datenmodell und die Anmeldung stehen, die fachlichen Endpoints größtenteils
noch nicht (siehe [docs/STAND.md](docs/STAND.md)).

## Tech-Stack

Alle Versionen aus `backend/pom.xml` bzw. `frontend/package.json` (Branch
`KAN-6-Frontend-Projekt-Setup-…`).

| Bereich    | Technologie                                          |
|------------|------------------------------------------------------|
| Backend    | Java 21, Spring Boot 3.5.9 (Web, Data JPA, Security, Validation, Actuator, DevTools) |
| Auth       | JJWT 0.12.6 (HS512), BCrypt                          |
| Datenbank  | PostgreSQL 16 (Docker-Image `postgres:16`), Flyway    |
| Build      | Maven Wrapper (`backend/mvnw`)                        |
| Frontend   | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, shadcn/ui, pnpm |
| API-Doku   | springdoc-openapi 2.8.6 (Swagger-UI, nur im Profil `dev`) |

## Repo-Aufbau

- `backend/` — Spring-Boot-Anwendung (Maven), inkl. Flyway-Migrationen unter `backend/src/main/resources/db/migration`
- `frontend/` — React/Vite-App; liegt **nicht in `main`**, sondern auf Branch `KAN-6-Frontend-Projekt-Setup-Design-Tokens-aus-Figma-übernehmen`
- `docs/` — diese Dokumentation

## Schnellstart

Voraussetzungen: JDK 21, Docker Desktop. Ausführlich in
[docs/SETUP.md](docs/SETUP.md).

```bash
cp .env.example .env
# In der .env mindestens POSTGRES_PASSWORD, JWT_SECRET und DEV_TEST_PASSWORT
# durch eigene Werte ersetzen. JWT_SECRET erzeugen mit:
#   openssl rand -base64 64
docker compose up -d db
cd backend && ./mvnw spring-boot:run
```

Prüfen: <http://localhost:8080/actuator/health> muss `{"status":"UP"}` liefern.
Die API lässt sich danach über <http://localhost:8080/swagger-ui.html>
ausprobieren.

Ohne gesetztes `JWT_SECRET` startet die Anwendung nicht — das ist Absicht, siehe
[docs/SETUP.md](docs/SETUP.md).

## Links

- Jira-Board: <https://hsb-portfolio.atlassian.net/browse/KAN>
- Confluence, API-Contract (Seiten-ID 36732929): <https://hsb-portfolio.atlassian.net/wiki/pages/viewpage.action?pageId=36732929>

## Weitere Dokumentation

- [docs/SETUP.md](docs/SETUP.md) — Installation, Start, Testnutzer, Fehlerbehebung
- [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) — Paketstruktur, Migrationen, Sicherheitsablauf, wo was hingehört
- [docs/STAND.md](docs/STAND.md) — Momentaufnahme: was umgesetzt ist und was nicht
