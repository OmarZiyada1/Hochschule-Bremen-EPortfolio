---
name: frontend-design
description: Regeln für Aussehen und Bedienbarkeit im Frontend des E-Portfolio Hochschule Bremen (Design-Tokens, Komponentenbibliothek, Beschriftungen, Barrierefreiheit nach WCAG 2.2). Immer verwenden, wenn eine Komponente entsteht, eine Farbe gesetzt oder ein Contract-Enum angezeigt wird.
---

# Aussehen und Bedienbarkeit

Quelle für alles Sichtbare ist das Figma-Designsystem und die
Template-Seiten unter „Figma-Prototype (Embed)" im Confluence-Space BEH.
Der Prototyp ist die Vorlage, nicht die Umsetzung: sein Code stammt aus
einem separaten Repository mit abweichendem Stack und wird nicht übernommen.

## 1. Farben stehen genau einmal

Alle Farbwerte liegen in `frontend/src/styles/tokens/tokens.css`
(Farben und Radien) und `frontend/src/styles/tokens/typography-tokens.css`
(Schrift), beide 1:1 aus der Figma-Collection „Primitives" und „Semantic"
exportiert und über den `@theme inline`-Block als Tailwind-Utilities
verfügbar (`bg-primary`, `text-muted-foreground`, `rounded-card` und so
weiter).

**Eine Hex-Farbe außerhalb von `frontend/src/styles/tokens/` ist ein
Befund.** Auch in einer Komponente, auch „nur kurz", auch im Diagramm.
Sonst gibt es das HSB-Blau in vier Nuancen und niemand weiß, welche gilt.

Das Tokensystem hat zwei Ebenen, und beide Regeln dazu verhindern fast jeden
Fehler:

1. **Primitives** (`--blau-*`, `--neutral-*`, `--rot-*`, `--bernstein-*`,
   `--gruen-*`, `--basis-*`) sind reine Rohwerte ohne Bedeutung, identisch in
   hell und dunkel. Sie werden **nie direkt in Komponenten verwendet**, nur
   von der Semantic-Ebene referenziert. Eine Primitive ohne Semantic-Rolle
   fliegt raus statt „vielleicht später" liegen zu bleiben; ein neuer
   Rohwert kommt aus einem frischen Figma-Export, nie freihändig aus dem
   Code.
2. **Semantic** ordnet jeder Primitive eine Rolle zu, mit eigenem hellem und
   dunklem Wert. Jede Vordergrundrolle gehört zu genau einer Flächenrolle
   (`card`/`card-foreground`, `primary`/`primary-foreground` und so weiter);
   eine Flächenrolle ist nie eine Textfarbe (`accent`, `muted`, `card`,
   `background` gehören an Flächen). Komponenten binden ausschließlich hier
   an.

Vorhandene Semantic-Gruppen:

| Gruppe | Beispiele | Themenabhängig |
| --- | --- | --- |
| Fläche und Text | `--background`, `--card`, `--foreground`, `--border` | ja |
| Interaktion | `--primary`, `--secondary`, `--accent`, `--destructive`, `--ring` | ja |
| Markenfläche | `--surface-brand`, `--surface-highlight` | ja (siehe unten) |
| Hinweis | `--warning`, `--success` | ja |
| Status | `--status-draft-bg` bis `--status-revision-fg` | ja |
| Rolle | `--role-student-bg` bis `--role-admin-fg` | ja |
| Radius | `--radius-none` bis `--radius-pill` | nein |

Status- und Rollen-Tokennamen folgen exakt den Enum-Werten aus dem
API-Contract (`ProjectStatus`, `Role`; `docs/NAMENSSCHEMA.md`): ein Umbenennen
hier bricht die Zuordnung zwischen API-Antwort und Badge-Farbe.

**Umgekehrt gilt dieselbe Regel: ein Token ohne Enum-Wert gehört nicht in
die Gruppe.** Es gibt drei Rollen (`STUDENT`, `EDITOR`, `ADMIN`) und damit
drei Token-Paare. „Öffentlich" ist keine Rolle, sondern der Zustand „nicht
angemeldet" (Abschnitt 3), und bekommt deshalb kein eigenes Token: ein
`role-public-*` legt eine vierte Rolle nahe, die weder im Backend noch in
der Rechtematrix existiert.

**Ein Badge nutzt immer sein eigenes `-fg`**, nie `muted-foreground` oder
eine andere allgemeine Textfarbe. Das sieht fast gleich aus, verliert aber
genau die Kontrastzusage, für die das Paar angelegt wurde.

**Fakultäts- und Studiengangs-Badges sind bewusst einfarbig**
(`--badge-neutral-bg`/`-fg`), keine Rainbow-Farbe je Fakultät. Begründung in
Confluence „Designentscheidungen", Abschnitt 2.4.

Markenflächen bleiben in hell und dunkel auf derselben Grundfarbe, wechseln
aber die Nuance, damit sie sich vom Seitenhintergrund absetzen (siehe
Kommentare direkt in `tokens.css`). Das Figma-Design ist nur hell angelegt;
neue dunkle Werte werden abgeleitet und auf Kontrast geprüft, nicht
geschätzt (Confluence „Designentscheidungen", Abschnitt 2.8).

**Die vier Brückenzeilen sind kein Fremdkörper.** Im `@theme inline`-Block
stehen zusätzlich `--radius-sm`, `--radius-md`, `--radius-lg` und
`--radius-xl` als Aliase auf `selection`, `control`, `card` und `modal`.
Sie tragen keinen eigenen Wert und stehen nicht in Figma: sie sind die
zweite Adresse der sechs Stufen, unter der die per CLI erzeugten Komponenten
sie finden. Wer sie beim Abgleich gegen die Figma-Collection als
überzähligen Token löscht, macht jede shadcn-Primitive still eckig, ohne
dass ein Test, ein Lint oder ein Typecheck darauf anspringt
(Skill `frontend-shadcn`, Abschnitt 7).

## 2. Wo eine Komponente wohnt

| Ort | Was dort hingehört |
| --- | --- |
| `components/ui/` | shadcn-Primitiven auf Radix UI, **ausschließlich per CLI erzeugt**, Bibliotheksnamen unverändert |
| `components/layout/` | NavBar, Footer, Breadcrumb |
| `components/common/` | alles mit Domänenbezug: `ProjectCard`, `StatusBadge`, `RoleBadge`, `EmptyState`, `KpiTile` |
| `features/<feature>/components/` | nur in diesem Feature verwendet |

Wird ein Baustein von der zweiten Seite gebraucht, wandert er nach oben,
statt kopiert zu werden. Zwei Fassungen derselben Projektkachel driften
zuverlässig auseinander.

**Primitiven werden nicht geschrieben, sondern erzeugt.** Alles unter
`components/ui/` kommt über `pnpm dlx shadcn@latest add <name>`; eine dort
von Hand angelegte Datei ist ein Befund. Von Hand entsteht nur, was
Domänenwissen trägt, und das komponiert die Primitiven, statt sie
nachzubauen: `StatusBadge` kennt die fünf Werte aus §2.2, `badge` kennt sie
nicht. Befehle, erlaubte Eingriffe an generierten Dateien und die
Tokenbrücke stehen im Skill `frontend-shadcn`.

**Namensregel:** Bezeichner englisch (`docs/NAMENSSCHEMA.md`). Generierte
Primitiven behalten ihren Bibliotheksnamen; ein Umbenennen von `button.tsx`
bricht jedes spätere `shadcn add`.

## 3. Contract-Enums anzeigen

Werte aus dem Contract (`PUBLISHED`, `EDITOR`, `THESIS`) laufen
**unverändert** durch den Code. Übersetzt wird nur für die Anzeige, über
i18n-Schlüssel mit dem Enum-Wert als letztem Bestandteil:

```ts
// de.json
{ "project": { "status": {
  "DRAFT": "Entwurf",
  "SUBMITTED": "Eingereicht",
  "APPROVED": "Genehmigt",
  "PUBLISHED": "Veröffentlicht",
  "REVISION": "Überarbeitung"
} } }

// im Code
<StatusBadge label={t(`project.status.${status}`)} />
```

Grund: Statusnamen erscheinen in Filtern, Badges, Tabellen und
Fehlermeldungen. Liegen sie verstreut, heißt derselbe Zustand auf zwei
Seiten unterschiedlich, und in der Thesis steht ein Screenshot, der dem
Contract widerspricht. Mit dem Schlüsselmuster gibt es je Enum genau eine
Stelle, und die Zweisprachigkeit fällt nebenbei ab.

Ein neuer Enum-Wert im Contract braucht einen Eintrag in `de.json` **und**
`en.json`. Fehlt er, erscheint der rohe Schlüssel in der Oberfläche; das ist
gewollt sichtbar und besser als ein stiller Rückfall auf den technischen
Wert.

Die Bezeichnung des Admin-Bereichs ist **„Administrationsseite"**, nie
„Cockpit". Der Projektname ist **„E-Portfolio Hochschule Bremen"**, nie
„Build Your Blocks" oder „BYB" (`CLAUDE.md`). Beides sind Übersetzungswerte,
keine Literale im Code.

`PUBLIC` ist keine Rolle, sondern der Zustand „nicht angemeldet" (§2.1).
Ein `RoleBadge` kennt drei Werte; die Navigation unterscheidet
angemeldet und nicht angemeldet.

## 4. Barrierefreiheit ist keine Nacharbeit

Der Contract beruft sich in §2.5 ausdrücklich auf WCAG 2.2 und begründet
damit die Beschränkung der Überschriftenebenen auf 1 bis 3. Eine
Hochschulplattform, die Barrierefreiheit im Datenmodell begründet und in
der Oberfläche ignoriert, wäre in sich widersprüchlich. Zielniveau ist AA.

Beim Bauen jeder Komponente:

- **Tastatur:** jede Aktion ohne Maus erreichbar, sichtbarer Fokusring,
  sinnvolle Reihenfolge, keine Fokusfalle in Dialogen.
- **Beschriftung:** jedes Formularfeld hat ein verbundenes Label. Ein
  Platzhalter ist kein Label; er verschwindet beim Tippen.
- **Schaltflächen mit reinem Symbol** brauchen einen zugänglichen Namen.
- **Überschriften** bilden eine Hierarchie ohne übersprungene Ebenen
  (Erfolgskriterium 1.3.1). Sie werden nicht für Schriftgrößen missbraucht.
- **Statusmeldungen** (Autosave, Fehler, Trefferzahl) laufen über eine
  Live-Region, sonst bleiben sie für Screenreader unsichtbar.
- **Bilder** aus Blöcken tragen den `alt`-Text aus den Node-Attributen
  (§2.5). Ein dekoratives Bild bekommt ein leeres `alt`, nicht keins.
- **Kontrast:** 4,5:1 für Text, 3:1 für Bedienelemente, in hell **und**
  dunkel. Betroffen sind vor allem die Status- und Rollenpillen.
  Zwei Fallen, die in der Praxis fast jeden Befund erklären:
  - **Gegen die tatsächlich sichtbare Fläche prüfen, nicht gegen die
    Elternfläche.** Liegt eine vollflächige Kachel oder ein Verlauf über
    einer weißen Karte, ist der Untergrund die Kachel. Wer die Elternfläche
    nimmt, hält eine weiße Karte für den Untergrund und übersieht dunkle
    Schrift auf dunklem Grund.
  - **Ein gemischtes Rollenpaar ist der häufigste Auslöser.**
    `surface-brand-muted` auf `card` ergibt 1,5:1, dieselbe Farbe auf
    `surface-brand` ergibt 7,2:1. Nicht die Farbe ist falsch, sondern die
    Fläche darunter (Abschnitt 1, Regel 2).
  - Ausgenommen ist allein `text-disabled`: WCAG nimmt inaktive
    Bedienelemente ausdrücklich von der Kontrastpflicht aus. Platzhalter
    zählen dagegen als Text und sind **keine** Ausnahme.
- **Farbe allein trägt keine Information.** Ein Status ist Text plus Farbe.
  Die Fakultätsfarbe ist Schmuck; die Fakultät steht daneben.

## 5. Responsiv

- Tabellen und breite Inhalte scrollen in ihrem eigenen Bereich. Die Seite
  selbst scrollt nie waagerecht.
- Ab 360 Pixel Breite bedienbar.
- Die Admin-Tabellen sind der schwierigste Fall: lieber je Zeile eine Karte
  auf schmalen Bildschirmen als eine gequetschte Tabelle.

## 6. Definition of Done

- [ ] Keine Hex-Farbe außerhalb von `frontend/src/styles/tokens/`
- [ ] Jede Primitive unter `components/ui/` per CLI erzeugt, keine von Hand
      angelegt oder inhaltlich verändert (Skill `frontend-shadcn`)
- [ ] Komponente in hell und dunkel geprüft
- [ ] Enum-Anzeige über i18n-Schlüssel, nicht über Literale; Schlüssel in
      `de.json` und `en.json`
- [ ] Vollständig mit der Tastatur bedienbar, Fokus sichtbar
- [ ] Jedes Feld beschriftet, jede Symbolschaltfläche benannt
- [ ] Überschriftenebenen ohne Sprung
- [ ] Kontrast geprüft, Abweichungen im Token korrigiert
- [ ] Kein waagerechtes Scrollen der Seite auf 360 Pixel
- [ ] Verbleibende Einschränkungen benannt, nicht verschwiegen
