---
name: frontend-modul
description: Baut eine Frontend-Feature-Einheit für das E-Portfolio Hochschule Bremen (Typen, Query-Hooks, Komponenten, Route, Tests) nach API-Contract, Figma-Template und Hauskonventionen. Immer verwenden, wenn ein KAN-Ticket eine neue Seite, Ansicht oder Komponente im React-Frontend verlangt.
---

# Frontend-Modul bauen (Typen bis Seite)

Ziel: Jede Ansicht entsteht in derselben Reihenfolge, aus denselben Quellen
und mit derselben Testtiefe. Das Frontend liegt als Ordner `frontend/` im
selben Repository wie das Backend.

Es gibt **zwei** verbindliche Vorlagen je Ticket, und sie beantworten
verschiedene Fragen:

- die **Confluence-Template-Seite** unter „Figma-Prototype (Embed)" sagt,
  *was* auf der Seite steht und wie sie aufgebaut ist,
- der **API-Contract** (Seite 36732929) sagt, *welche Daten* es gibt, wer sie
  sehen darf und welche Fehler auftreten.

Widersprechen sie sich, ist das kein Umsetzungsdetail, sondern eine
Entscheidung. Siehe Schritt 0b.

## 0. Vorbereitung (nie überspringen)

1. **Konnektoren prüfen, vor allem anderen.** Beide Vorlagen dieses Skills
   hängen daran: Confluence und Jira am Atlassian-Konnektor, das Template am
   Figma-Konnektor. Je ein lesender Aufruf,
   `mcp__claude_ai_Atlassian_Rovo__atlassianUserInfo` (erwartet: ein Konto mit
   `account_status: active`) und `mcp__claude_ai_Figma__whoami` (erwartet: ein
   Handle mit dem Team „BA E-Portfolio HSB" in `plans`; ohne dieses Team sind
   die Projektdateien unsichtbar, obwohl die Anmeldung steht). Geprüft wird,
   dass ein Konto antwortet, nicht welches: die Konten sind je Entwickler
   verschieden. Das Ergebnis wird immer genannt, auch wenn beides
   läuft („Konnektoren: Atlassian ok, Figma ok"). Fehler, Zeitüberschreitung
   oder Anmeldeaufforderung heißt: anhalten und darum bitten, den Konnektor
   auf claude.ai neu zu verbinden und die IDE (Cursor bzw. VS Code) neu zu
   starten. Bei einem Frontend-Ticket blockieren **beide** Konnektoren, denn
   ohne Figma wird die Seite aus der Erinnerung gebaut, und genau das war der
   Befund aus KAN-8 (`CLAUDE.md`, Abschnitt „Konnektoren prüfen, bevor ein
   Ticket beginnt").
2. Arbeitsstand prüfen: `git fetch` und `git status -sb`. Liegt der
   ausgecheckte Branch hinter seinem Remote (auf `main` gegen
   `origin/main`), wird nicht gebaut, sondern das Aktualisieren erbeten;
   `git pull` ist ein schreibender Befehl und bleibt bei Omar (Skill
   `uebergabe`). Ein veralteter Stand erzeugt Arbeit, die der nächste Pull
   wegwirft (`CLAUDE.md`, Arbeitsablauf Schritt 1).
3. Jira-Ticket lesen; die genannte Template-Seite in Confluence lesen
   (Abschnitte „Layout-Bereiche", „Verknüpfte Komponenten", „Verweist auf").
4. Die genannten Contract-§§ nachschlagen, mindestens §5 (Rechtematrix),
   §6.1 (Endpoint-Zeilen), §6.2 (Fehlercodes). Ohne die Endpoint-Zeile wird
   keine Ansicht gebaut, sonst entsteht eine Oberfläche für Daten, die es
   nicht gibt.
5. Prüfen, was schon existiert: `frontend/src/components/`,
   `frontend/src/api/`, `frontend/src/styles/tokens/`. Komponenten werden
   wiederverwendet, nicht je Seite neu gebaut. Fehlt eine Komponente, die
   mehrere Seiten brauchen, gehört sie in die Bibliothek (Skill
   `frontend-design`), nicht in den Feature-Ordner. Fehlt eine **Primitive**,
   wird sie per `pnpm dlx shadcn@latest add` erzeugt und nicht geschrieben
   (Skill `frontend-shadcn`); `pnpm dlx shadcn@latest info` zeigt, was
   bereits installiert ist. Das Inventar gilt auch für Flächen, die nach
   einfachem Markup aussehen: Fehler-, Zustands- und Meldungsseiten sind
   Leerzustände und kommen aus der `empty`-Primitive bzw. der Domänenhülle
   `EmptyState`; eine fast passende Hülle wird erweitert, nicht umgangen
   (Befund aus KAN-7, Skill `frontend-shadcn` Abschnitt 1).
6. Prüfen, ob der benötigte Endpoint im Backend **wirklich existiert**:
   die Controller unter `backend/src/main/java/de/hsbremen/eportfolio/` oder
   `/v3/api-docs` im laufenden Dev-Profil. Eine Contract-Zeile ist kein
   Beleg für einen umgesetzten Endpoint; §8 nennt den Umsetzungsstand.

## 0a. Figma zuerst: die Seite sieht aus wie das Template (nie überspringen)

Bevor die erste Komponente einer Seite entsteht, wird das Figma-Template
genau dieser Seite **angesehen**, nicht erinnert: die Template-Seite unter
„Figma-Prototype (Embed)" in Confluence, dazu die Screenshots, die Omar
bereitstellt. Kommt dabei ein Konnektorfehler statt eines Inhalts zurück, ist
das kein Grund weiterzubauen, sondern der Fall aus Schritt 0.1: erst wird der
Konnektor neu verbunden und die IDE neu gestartet. Ist das Template auch
danach nicht zugänglich, wird um Screenshots gebeten, statt aus dem Kopf zu
bauen. Der Anlass ist ein Befund aus dem Review zu
KAN-8: mehrere Ansichten sahen „ungefähr richtig" aus und mussten komplett
nachgezogen werden.

Verbindlich heißt: die fertige Seite wird Bereich für Bereich gegen das
Template gehalten. Gleiche Anordnung, gleiche Bausteine, gleiche
Beschriftungen, gleiche Zustände (angemeldet/nicht angemeldet, je Rolle),
gleiche Radien nach den Foundation-Stufen (Bedienelemente 8px, Karten 12px,
Modale 16px). Eine Abweichung ist entweder eine entschiedene Frage aus der
Klärungsrunde (0b) mit Begründung im Übergabekommentar, oder sie ist ein
Fehler. „Sieht ähnlich aus" ist keine Umsetzung.

Zwei Dinge zeigt das Template **nicht**, und beide bleiben trotzdem
Pflicht:

- **Responsivität.** Die Templates sind Desktop-Ansichten. Die Umsetzung
  bleibt ab 360px bedienbar (Skill `frontend-design`, Abschnitt 5). *Wie*
  eine Fläche umbricht, entscheidet die Umsetzung; *dass* sie umbricht, ist
  nicht verhandelbar.
- **Maße in rem.** Größen, Abstände und Schriftgrade werden in rem
  ausgedrückt: die Tailwind-Utilities (`p-4`, `gap-6`, `max-w-6xl`) sind
  rem-basiert und damit die richtige Wahl. Ein freier px-Wert in eigenem
  CSS oder in eckigen Klammern (`w-[320px]`) ist ein Befund. px bleibt nur
  für Haarlinien (`border`, 1px) und für Token, deren Stufe px-basiert
  definiert ist (Radius).

## 0b. Klärungsrunde vor der ersten Codezeile (nie überspringen)

Fragen werden **vorher** gestellt, nicht im Abschlussbericht gesammelt
(Regel „Fragen vor der Umsetzung" in `CLAUDE.md`). Nach Schritt 0, vor
Schritt 1: alle entscheidungsrelevanten Punkte **in einer Runde** über
`AskUserQuestion` vorlegen, je Frage zwei bis vier Optionen, die empfohlene
zuerst und mit „(Empfohlen)" markiert.

Typische Kandidaten im Frontend:

- **Template zeigt etwas, das der Contract nicht hergibt.** Ein Feld, ein
  Filter, eine Aktion ohne Endpoint. Entweder das Template gewinnt (dann
  Contract-Nachtrag, Skill `api-contract-sync`) oder der Contract (dann
  entfällt das Element). Nie eine Attrappe bauen, die nichts tut.
- **Contract gibt mehr her, als das Template zeigt.** Weglassen oder
  ergänzen?
- Verhalten bei einem Fehlerfall, den weder Template noch Contract
  beschreiben (leere Liste, Teilberechtigung, Versionskonflikt).
- Eine neue Abhängigkeit wäre nötig (`CLAUDE.md`, Regel 9).

Nicht gefragt wird nach Dingen, die Contract, Template oder diese Skills
schon beantworten: Komponentennamen, Ordnerablage, Testaufbau, Reihenfolge.

## 1. Typen (`frontend/src/api/schema.d.ts`)

Response- und Request-Typen werden **aus `/v3/api-docs` generiert**
(`openapi-typescript`) und nie von Hand nachgebaut. Die generierte Datei
wird eingecheckt und nicht bearbeitet.

Grund: der Contract nennt `/v3/api-docs` als autoritative maschinenlesbare
Fassung. Ein handgeschriebener Typ weicht spätestens beim zweiten
Feldnamen ab, und der Bruch fällt erst zur Laufzeit auf.

Erlaubt sind abgeleitete Typaliase im Feature (`type Projekt =
components['schemas']['ProjektDetailAntwort']`), damit die Importpfade
lesbar bleiben.

## 2. Datenzugriff (`features/<feature>/hooks/` + `src/api/queries/`)

- Ein Hook je Serveroperation, benannt nach der Fachlichkeit:
  `useProjectList`, `useProjectDetail`, `useSaveProject`.
- Lesen über `useQuery`, Schreiben über `useMutation` (TanStack Query).
  Kein `fetch` im Komponentenkörper, kein `useEffect` zum Laden.
- **Hooks kennen weder Pfade noch `api.*`.** Die Query-Definition kommt als
  `queryOptions`-Fabrik aus `src/api/queries/<ressource>.ts` (eine Datei je
  Ressource: `projects.ts`, `comments.ts`, …). Die Fabrik bündelt Pfad,
  Response-Typ **und** Query-Key an genau einer Stelle; nur sie ruft den
  zentralen Client (Skill `frontend-api`), nie über ein eigenes `fetch`.
  **Der Pfad selbst steht auch in der Fabrik nicht als Literal**, sondern
  kommt aus `src/api/endpoints.ts` (`apiPaths`, Review zu KAN-8): ändert
  sich ein Pfad im Contract, gibt es genau eine Fundstelle. Ein Pfad wird
  dort erst mit seinem ersten Verwender eingetragen, nie auf Vorrat:

  ```ts
  // src/api/queries/projects.ts
  export const projectQueries = {
    list: (params: ProjectListParams) =>
      queryOptions({
        queryKey: ["projects", params],
        queryFn: () =>
          api.get<PageResponse<ProjectCard>>(apiPaths.projects.list, {
            query: { page: params.page, sort: params.sort },
          }),
      }),
    detail: (id: string) =>
      queryOptions({
        queryKey: ["project", id],
        queryFn: () => api.get<ProjectDetail>(apiPaths.projects.detail(id)),
      }),
  }

  // features/projects/hooks/useProjectList.ts
  export function useProjectList(params: ProjectListParams) {
    return useQuery(projectQueries.list(params))
  }
  ```

  Mutationsfunktionen derselben Ressource (`saveProject`, `submitProject`)
  liegen als einfache Funktionen in derselben Datei; der Feature-Hook packt
  sie in `useMutation`. Eine Fabrik entsteht erst mit ihrem ersten
  Verwender, nie auf Vorrat: ein Eintrag ohne Endpoint in Contract §6.1
  ist ein Befund. Query-Parameter laufen über die `query`-Option des
  Clients, nie handgebaut im Pfad-String.
- Query-Keys tragen alle Parameter, die das Ergebnis beeinflussen. Sonst
  zeigt die Liste nach einem Filterwechsel das Ergebnis des vorigen Filters.
  Weil Key und Funktion in der Fabrik zusammenstehen, kann der Key nicht
  vom Request abweichen.
- Nach einer erfolgreichen Mutation die betroffenen Queries invalidieren,
  statt den lokalen Zustand von Hand nachzuziehen; den Key liefert die
  Fabrik, er wird nie von Hand nachgebaut:
  `queryClient.invalidateQueries({ queryKey: projectQueries.detail(id).queryKey })`.

## 3. Komponenten und Seite (`features/<feature>/`)

Ablage nach Feature, analog zum package-by-feature im Backend
(`docs/ARCHITEKTUR.md` §6):

```
frontend/src/
  index.css               CSS-Einstiegspunkt: Tailwind, Tokendateien
  api/                    client.ts, errors.ts, schema.d.ts, page.ts, auth/
    queries/              queryOptions-Fabriken + Mutationsfunktionen je Ressource
  components/
    ui/                   shadcn-Primitiven auf Base UI (nur per CLI erzeugt)
    layout/               NavBar, Footer, Sidebar
    common/               ProjectCard, StatusBadge, Top10Card, EmptyState, …
  features/<feature>/
    <Feature>Page.tsx     die Route-Komponente
    components/           nur hier verwendete Bausteine
    hooks/                Query- und Mutation-Hooks
  i18n/                   de.json, en.json, index.ts
  lib/
  routes/
  styles/tokens/
```

**Bevor eine Komponente von Hand entsteht:
`pnpm dlx shadcn@latest search @shadcn -q <text>`.**
Gibt es eine Registry-Entsprechung, wird sie über `add` erzeugt und nicht
nachgebaut; von Hand entsteht nur, was Domänenwissen trägt, und das
komponiert die Primitiven. Ein selbst gebautes Auswahlmenü sieht im Browser
richtig aus und ist mit der Tastatur fast immer unbrauchbar. Die Suche gilt
auch, wenn die Fläche nach bloßem Markup aussieht: Leerzustände,
Fehlerseiten und Meldungsflächen haben mit `empty` eine
Registry-Entsprechung, und eine fast passende Domänenhülle (`EmptyState`)
wird erweitert statt umgangen (Befund aus KAN-7). Regeln dazu im
Skill `frontend-shadcn`.

**Bevor eine Primitive verwendet wird: Import und API nachschlagen, nicht
raten.** `pnpm dlx shadcn@latest view <item>` zeigt den Quelltext samt
Exporten, `docs <item>` die Anwendungshinweise. Importiert wird
ausschließlich aus `@/components/ui/<name>` (Aliase aus `components.json`);
ein direkter Import aus `@base-ui/react` außerhalb von `components/ui/` ist
ein Befund. Geratene Prop- oder Exportnamen fallen erst im Typecheck oder gar
nicht auf; die Registry ist die Quelle, nicht die Erinnerung.

**Namensregel:** Bezeichner sind englisch (`ProjectCard`, `useProjectList`,
`projectId`); die verbindliche Zuordnung steht in `docs/NAMENSSCHEMA.md`.
Enum-Werte aus dem Contract erscheinen unverändert (`PUBLISHED`, `EDITOR`)
und werden nur für die Anzeige übersetzt, nie im Datenfluss umbenannt.

Der blockbasierte Editor liegt unter `features/project-content/`, seine
Hauptkomponente heißt `BlockEditor`. Sonst bezeichnete „editor" zugleich die
Rolle `EDITOR` und das Eingabewerkzeug.

- Die Seite komponiert, sie rechnet nicht. Ableitungen und Formatierungen
  gehören in kleine Funktionen daneben, damit sie ohne Rendern testbar sind.
- Kein Zustand doppelt halten: was der Server weiß, kommt aus Query;
  was in der URL steht, kommt aus der URL.
- Filter, Suche, Sortierung und Seite gehören **in die URL**, nicht in
  `useState`. Sonst ist ein Ergebnis weder teilbar noch überlebt es den
  Zurück-Knopf.

## 3b. Formulare: react-hook-form mit zod, ohne Ausnahme

Jedes Formular läuft über `react-hook-form` mit einem `zod`-Schema, verbunden
über `zodResolver` aus `@hookform/resolvers/zod`. Handgeschriebene
Validierungslogik neben dem Schema (ein `if` auf den Feldwert, ein eigener
`onBlur`-Prüfer) ist ein Befund: sie driftet vom Schema weg und wird nie
mitgetestet.

- **Ein Schema je Formular**, abgelegt neben der Formularkomponente
  (`<Feature>Form.schema.ts`). Die Regeln kommen aus dem Contract und werden
  im Ticket genannt: Längen (Titel 100, Kurzbeschreibung 200), Muster
  (sechsstelliger Code), Passwortregel (12 bis 72 Zeichen, §3.1.1), Pflicht-
  und Bedingungsfelder.
- **Fehlertexte sind i18n-Schlüssel**, keine Literale im Schema. Das Schema
  hinterlegt den Schlüssel (`validation.password.tooShort`), die Anzeige
  übersetzt ihn; jeder Schlüssel steht in `de.json` **und** `en.json`.
- **zod prüft Eingaben, nie Serverantworten.** Response-Typen kommen aus der
  generierten `schema.d.ts` (Abschnitt 1); ein zod-Schema über eine
  Serverantwort ist ein handgeschriebener Response-Typ in Verkleidung und
  damit derselbe Befund.
- **Der Server bleibt verbindlich.** Das Schema macht Fehler vor dem Absenden
  sichtbar, ersetzt aber keine Serverprüfung. Ein 400 `VALIDATION_FAILED`
  aus dem Envelope wird über `setError` auf das betroffene Feld gelegt
  (Skill `frontend-api`, Abschnitt 3); Codes wie 409 `RESOURCE_IN_USE`
  erscheinen als eigene Meldung am Feld, nicht als Formatfehler.
- **Markup über die Primitiven** `field`, `input`, `label` aus der CLI
  (Skill `frontend-shadcn`); Fehlerzustand über deren vorgesehene Props,
  keine eigene Fehlerdarstellung daneben.

Die Pakete `react-hook-form`, `zod` und `@hookform/resolvers` sind
freigegeben (Frontend-Regel 12 in `CLAUDE.md`) und werden mit dem ersten
Formular-Ticket aufgenommen, das gebaut wird.

## 4. Route (`frontend/src/routes/`)

- Route in den bestehenden Baum eintragen, mit dem Wrapper der passenden
  Zugriffsebene (§2.1: nicht angemeldet, `STUDIERENDE`, `REDAKTEUR`,
  `ADMIN`).
- Die Sichtbarkeitsregel im Routing ist eine Bequemlichkeit, **keine
  Sicherheitsmaßnahme** (§5). Die Seite muss 401 und 403 trotzdem sichtbar
  behandeln.

## 5. Drei Zustände, immer (nicht optional)

Jede Ansicht, die Serverdaten zeigt, behandelt alle drei:

| Zustand | Darstellung |
| --- | --- |
| Laden | Skeleton in der Form des Ergebnisses, kein zentrierter Spinner |
| Leer | `EmptyState` mit Erklärung und, wo sinnvoll, einer Handlung |
| Fehler | Meldung aus dem `ApiError` (§6.2), nie ein roher Statuscode |

Eine leere Fläche ist kein Zustand, sondern ein übersehener Fall. Das gilt
besonders für 401: ein abgelaufenes Token darf nie in einer leeren Seite
enden (§6.5).

## 5b. Texte kommen aus i18n

Kein sichtbarer Text steht als Literal im JSX. Jeder Text ist ein
i18n-Schlüssel (`react-i18next`), gepflegt in `de.json` **und** `en.json`;
Deutsch ist die Standardsprache.

- Schlüssel nach Bereich gliedern: `project.list.title`,
  `project.status.PUBLISHED`, `common.action.save`.
- **Enum-Werte sind Schlüsselbestandteil, nicht Text.** Der Wert
  `PUBLISHED` läuft unverändert durch den Code; übersetzt wird über
  `t('project.status.' + status)`. So gibt es je Enum genau eine
  Übersetzungsstelle statt einer pro Seite.
- Zahlen, Daten und Pluralformen über die Formatierung der Bibliothek, nicht
  von Hand zusammengesetzt. „1 Projekte gefunden" entsteht sonst zuverlässig.
- Fehlermeldungen: die Anzeige richtet sich nach `errorCode` aus dem
  Envelope (§6.2), der Text kommt aus i18n. Der `message` des Servers ist
  Rückfallebene, nicht die Hauptquelle, weil er nur deutsch existiert.
- Ein neuer Schlüssel wird in **beiden** Dateien angelegt. Ein Schlüssel nur
  in `de.json` fällt im englischen Betrieb als roher Schlüsselname auf.

## 6. Tests (`src/tests/`, gespiegelte Quellstruktur)

Tests sind Teil jedes Tickets, wie im Backend. Vitest, Testing Library,
Serverantworten über MSW. Testdateien liegen nicht neben dem Prüfling,
sondern unter `src/tests/` in einem Baum, der die Quellstruktur spiegelt
(seit KAN-62): `src/features/home/HomePage.tsx` wird durch
`src/tests/features/home/HomePage.test.tsx` geprüft. Der Prüfling wird über
den Alias importiert (`@/features/home/HomePage`), nie relativ; die
Render-Hilfe `renderWithProviders` kommt aus `@/tests/render`.

Pflichtfälle je Ansicht:

- Happy Path mit realistischer Antwort
- leere Ergebnismenge zeigt den Leerzustand
- Fehlerantwort aus dem §6.2-Envelope wird sichtbar
- geschützte Ansicht ohne Token führt sichtbar zum Login
- je Mutation: Erfolg und der fachlich erwartete Fehler (409, 400)

Getestet wird über die sichtbare Oberfläche (Rollen, Beschriftungen), nicht
über interne Props. Ein Test, der die Implementierung nachbaut, bricht bei
jeder Umbenennung und belegt nichts.

## 7. Definition of Done (Checkliste)

- [ ] Klärungsrunde vor dem ersten Code stattgefunden, Umsetzung folgt den
      Antworten
- [ ] **Keine offene Frage übrig**: was bleibt, sind entschiedene Punkte mit
      Begründung
- [ ] Alle „Layout-Bereiche" der Template-Seite umgesetzt oder ihr Entfallen
      begründet
- [ ] Die fertige Seite Bereich für Bereich gegen das Figma-Template
      gehalten (Abschnitt 0a): gleiche Anordnung, Bausteine, Beschriftungen
      und Radien; jede Abweichung ist entschieden und benannt
- [ ] Maße in rem über die Tailwind-Utilities; kein freier px-Wert außer
      Haarlinien und px-basierten Token (Abschnitt 0a), ab 360px bedienbar
- [ ] Kein handgeschriebener Response-Typ, alles aus `schema.d.ts`
- [ ] Jede Query-Definition ist eine `queryOptions`-Fabrik unter
      `src/api/queries/`; Hooks kennen weder Pfade noch `api.*`, und
      invalidiert wird über die Keys der Fabrik, nie über nachgebaute
      Key-Literale (Abschnitt 2)
- [ ] Keine Primitive von Hand nachgebaut, für die es einen Registry-Eintrag
      gibt; Dateien unter `components/ui/` nur per CLI erzeugt; Import und
      API jeder verwendeten Primitive per `view`/`docs`
      nachgeschlagen, Importe nur aus `@/components/ui/…`
      (Skill `frontend-shadcn`)
- [ ] Jede neue Datei mit sichtbarer Struktur (auch unter `features/` und
      `routes/`) gegen das Inventar aus `components/ui/` und
      `components/common/` gehalten; Zustands- und Meldungsflächen aus
      `empty`/`EmptyState`, fast passende Hüllen erweitert statt umgangen
      (Befund aus KAN-7)
- [ ] Jedes Formular validiert über ein zod-Schema mit `react-hook-form`
      (Abschnitt 3b); keine Validierungslogik daneben, kein zod-Schema über
      einer Serverantwort; Server-Feldfehler (400 `VALIDATION_FAILED`)
      erscheinen am Feld
- [ ] Kein sichtbarer Text als Literal im JSX, jeder Schlüssel in `de.json`
      **und** `en.json`, auch die aus generierten Komponenten
- [ ] Jeder `sr-only`-Text ist **erreichbar**, nicht nur vorhanden:
      `expect(screen.getByText(t).closest("[aria-hidden]")).toBeNull()`.
      Ein Text im DOM, den `aria-hidden` verdeckt, besteht `getByText`
      anstandslos und wird trotzdem nie vorgelesen (Befund aus KAN-29)
- [ ] Überschriften über `getByRole("heading", { level })` nachgewiesen, nicht
      über `getByText`. Registry-Primitiven rendern ihren Titel als `div`; die
      Ebene setzt die Domänenhülle (Skill `frontend-design`)
- [ ] Laden, Leere und Fehler sind je Ansicht behandelt
- [ ] Filter- und Seitenzustand steht in der URL und übersteht einen Reload
- [ ] Keine Hex-Farbe außerhalb von `frontend/src/styles/tokens/`
- [ ] Bedienbar mit der Tastatur, sichtbarer Fokus (Skill `frontend-design`)
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` grün
- [ ] Keine neuen Abhängigkeiten ohne Absprache
- [ ] Kein Mock und keine Attrappe im ausgelieferten Code
- [ ] Texte, Kommentare und Jira-Text ohne Em-Dash `—`
- [ ] Jira-Kommentar mit den getroffenen Entscheidungen. **Kein Nachtrag zum
      Sollzustand:** was sich am Ticketinhalt verschoben hat, wird in der
      Beschreibung nachgezogen (Skill `ticket-refinement`)
- [ ] Kein Commit, kein Push, kein PR durch Claude, stattdessen Übergabeblock
      nach Skill `uebergabe`
