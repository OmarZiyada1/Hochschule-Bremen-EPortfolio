---
name: frontend-design
description: Regeln für Aussehen und Bedienbarkeit im Frontend des E-Portfolio Hochschule Bremen (Design-Tokens, Komponentenbibliothek, Beschriftungen, Barrierefreiheit nach WCAG 2.2). Immer verwenden, wenn eine Komponente entsteht, eine Farbe gesetzt oder ein Contract-Enum angezeigt wird.
---

# Aussehen und Bedienbarkeit

Quelle für alles Sichtbare ist das Figma-Designsystem und die
Template-Seiten unter „Figma-Prototype (Embed)" im Confluence-Space BEH.
Der Prototyp ist die Vorlage, nicht die Umsetzung: sein Code stammt aus
einem separaten Repository mit abweichendem Stack und wird nicht übernommen.

Beides liegt in **einer** Figma-Datei, File-Key `o6SECXRMKGOzCfG5xZebPV`:
Seite `Foundation` ist Node-ID `0:1` (Farben, Typografie, Radius, Elevation),
`Components` ist `1:2`, `Template` ist `4:611`. Die Seite `4:611` steht
**nicht** in der Seitenliste von `get_metadata` und wird immer direkt
angesteuert; Einzelheiten und Fallstricke in `CLAUDE.md`, Abschnitt „Die
Figma-Arbeitsdatei".

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

**Die fünf Brückenzeilen sind kein Fremdkörper.** Im `@theme static`-Block
stehen zusätzlich `--radius-sm`, `--radius-md`, `--radius-lg` und
`--radius-xl` als Aliase auf die Figma-Stufen, seit KAN-29 dazu
`--radius-4xl` als Alias auf `pill` (das Badge der Registry nutzt
`rounded-4xl` und ist in Figma eine Pille). Zugeordnet wird nach der
tatsächlichen Verwendung in den erzeugten Dateien, nicht nach
Namensähnlichkeit (Review zu KAN-8): `sm` auf `selection` (4px), `md`
**und** `lg` auf `control` (8px, Eingabefelder und Buttons), `xl` auf
`card` (12px, Karten). `modal` (16px) hat keine Brückenzeile; modale
Flächen setzen `rounded-modal` an der Verwendungsstelle. Die Zeilen tragen
keinen eigenen Wert und stehen nicht in Figma: sie sind die zweite Adresse
der sechs Stufen, unter der die per CLI erzeugten Komponenten sie finden.
Wer sie beim Abgleich gegen die Figma-Collection als überzähligen Token
löscht, macht jede shadcn-Primitive still eckig, ohne dass ein Test, ein
Lint oder ein Typecheck darauf anspringt
(Skill `frontend-shadcn`, Abschnitt 7).

**Fünf Zeilen, aber sieben Stufen auf der Gegenseite.** shadcns Skala führt
zusätzlich `2xl` und `3xl`. Die bleiben bewusst ohne Brückenzeile, weil
keine erzeugte Komponente sie nutzt und kein Token auf Vorrat entsteht.
Taucht eine solche Klasse in einer erzeugten Komponente auf, ist das ein
Befund in der Tokenschicht und wird dort aufgelöst, nicht im Komponentencode.

## 2. Wo eine Komponente wohnt

| Ort | Was dort hingehört |
| --- | --- |
| `components/ui/` | shadcn-Primitiven auf Base UI, **ausschließlich per CLI erzeugt**, Bibliotheksnamen unverändert |
| `components/layout/` | NavBar, Footer, Sidebar |
| `components/common/` | alles mit Domänenbezug: `ProjectCard`, `StatusBadge`, `Top10Card`, `Pill`, `EmptyState`, `KpiTile` und weitere; Breadcrumb hat bewusst **keine** Hülle, die Primitive reicht |
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
- **Schaltflächen mit reinem Symbol** brauchen einen zugänglichen Namen,
  und zwar als `sr-only`-Text im Knopf. Ein **Tooltip ist kein Name**: er
  erscheint auf Touch gar nicht, und die Registry-Primitive hängt ihn
  nachgemessen weder als `aria-labelledby` noch als `aria-describedby` an
  den Auslöser, ist für Screenreader also gar nicht vorhanden. Er ist die
  sichtbare Ergänzung für die Maus und gehört an jedes Symbol, das ohne
  Text steht (`tooltip` aus der Registry, ein Provider je Gruppe für die
  gemeinsame Verzögerung). Kurz im Tooltip, vollständig im Namen:
  „Löschen" gegen „Löschen: {{title}}". Ein Test, der den Tooltip prüft,
  sucht seinen **Text**; eine `tooltip`-Rolle gibt es nicht.
- **Überschriften** bilden eine Hierarchie ohne übersprungene Ebenen
  (Erfolgskriterium 1.3.1). Sie werden nicht für Schriftgrößen missbraucht.
  **Die Ebene setzt die Domänenhülle, nicht die Primitive.** `CardTitle`
  und `EmptyTitle` rendern ein `div`; sie können die Ebene nicht kennen,
  weil sie nicht wissen, worunter sie sitzen. Ausgenommen sind
  `DialogTitle` und `AlertDialogTitle`: die rendern unter Base UI selbst
  ein `h2` (nachgeprüft in `@base-ui/react/dialog/title`), dort wird keine
  Ebene nachgereicht, und ein zusätzlich hineingelegtes `h2` wäre eine
  Überschrift zu viel. Also nimmt die Hülle sie als Prop entgegen und legt ein
  echtes `h2`/`h3` hinein, wie `ProjectCard` es für `CardTitle` tut. Fehlt
  das, trägt die Seite keinen einzigen Sprungpunkt: in KAN-29 war der
  Leerzustand jeder Liste auf diese Weise für die Überschriftennavigation
  unsichtbar, und der Test hat es nicht gemerkt, weil er über `getByText`
  statt über `getByRole("heading")` prüfte.
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

### Zustände meldet Base UI über ARIA, nicht über das DOM

Seit KAN-61 liegt die Bibliothek auf Base UI, und das ändert eine Sache, die
in jeder selbst geschriebenen CSS-Regel wiederkommt: **`:disabled` gibt es nur
an Formularelementen.** Ein `div` oder `span` mit `role="button"`, wie Base UI
und `react-day-picker` sie erzeugen, meldet den inaktiven Zustand über
`aria-disabled`. Dasselbe Muster gilt für `data-checked`, `data-open` und
`data-selected`.

Eine Regel, die nur auf den DOM-Zustand hört, greift deshalb an genau den
Stellen nicht, an denen sie gebraucht wird:

```css
/* falsch: trifft die Monatsnavigation von calendar.tsx nie */
button:not(:disabled) { cursor: pointer; }

/* richtig */
button:not(:disabled):not([aria-disabled="true"]) { cursor: pointer; }
```

Der Befund aus KAN-29 sah harmlos aus: eine abgeblendete Schaltfläche behielt
den Zeigefinger und versprach damit eine Bedienbarkeit, die es nicht gab.
`tokens.test.ts` verlangt seitdem, dass jede Regel mit `:disabled` auch
`aria-disabled` abdeckt.

## 5. Handlungen mit Folgen fragen nach

**Eine Handlung, die den Zustand für andere sichtbar verändert oder sich
nicht mit demselben Klick zurücknehmen lässt, wird bestätigt, bevor sie
läuft.** Nicht als freundliche Geste, sondern weil ein Fehlklick sonst
Arbeit vernichtet: WCAG 2.2 nennt das in Erfolgskriterium 3.3.4
(Fehlervermeidung) und verlangt für Daten, die Nutzende selbst
verantworten, entweder Umkehrbarkeit, Prüfung oder Bestätigung. Die
Bestätigung ist der Weg, den dieses Projekt geht.

Bestätigt wird über die Registry-Primitive `alert-dialog` (nie über
`window.confirm`, nie über einen selbst gebauten Kasten), mit diesem
Aufbau:

- **Titel:** die Handlung als Frage oder als Vorgang, in der Sprache der
  Oberfläche („Projekt löschen?", „Projekt zurückziehen").
- **Text:** was genau geschieht, mit dem betroffenen Gegenstand beim Namen.
  Der Titel des Projekts steht darin, nicht „dieses Element". Bei
  Unumkehrbarem steht der Satz ausdrücklich dabei („Das lässt sich nicht
  rückgängig machen.").
- **Auch der Auslöser nennt den Gegenstand**, sobald dieselbe Handlung in
  einer Liste mehrfach vorkommt. Fünf Karten mit fünfmal „Löschen" ergeben
  eine Elementliste, in der nichts zu unterscheiden ist; der zugängliche
  Name lautet deshalb „Löschen: {{title}}" (SC 2.4.6). Sichtbar bleibt das
  Symbol.
- **Zwei Schaltflächen:** Abbrechen zuerst, dann die Handlung mit ihrem
  eigenen Verb beschriftet, nie „OK". Nur was wirklich zerstört, trägt
  `variant="destructive"`; ein umkehrbarer Schritt wie das Zurückziehen
  bekommt die normale Betonung, sonst verliert Rot seine Bedeutung.
- **Abbrechen stellt den Zustand von vorher wieder her**, einschließlich
  Fokus: die Rückfrage darf nichts vorwegnehmen. Wer sie aus einem anderen
  Dialog heraus auslöst, lässt diesen offen und legt die Rückfrage darüber
  (Base UI kennt geschachtelte Dialoge); ihn vorher zu schließen hieße, dass
  der Abbruch bereits die halbe Wirkung hat.
- **Ein gesteuerter Dialog ohne Trigger benennt sein `finalFocus`.** Ohne
  auslösendes Element hat Base UI beim Schließen kein Rückgabeziel, und der
  Fokus fällt auf `body` (SC 2.4.3).
- **Wo die Meldung danach steht, entscheidet, ob der Dialog schließt.** Nach
  der Bestätigung schließt er, und der Ausgang erscheint an einer Stelle,
  die danach noch im Baum steht. Bleibt er offen, steht die Meldung in ihm.
  Verboten ist allein der dritte Fall: Dialog zu und Meldung in einem
  Knoten, der mit ihm verschwindet. Der Fehlschlag ist dann unsichtbar, und
  für die Person passiert scheinbar nichts (zweimal Befund in KAN-69).

Wann eine Rückfrage Pflicht ist und wann sie nur stört:

| Fall | Rückfrage |
| --- | --- |
| Löschen von Projekt, Block, Datei, Kommentar, Stammdatum | ja, mit „unwiderruflich" im Text |
| Statuswechsel, der fremde Sicht ändert: einreichen, zurückziehen, genehmigen, veröffentlichen, zur Überarbeitung zurückgeben | ja |
| Konto deaktivieren, Rolle ändern, Passwort zurücksetzen (Administration) | ja, mit dem Hinweis auf die sofortige Wirkung |
| Zusammenführen von Kategorien, Umsortieren mit Datenwirkung | ja |
| Speichern, Filtern, Sortieren, Navigieren, Anlegen eines Entwurfs | nein, das wäre nur ein Klick mehr |
| Verlassen einer Seite mit ungespeicherten Eingaben | ja, sobald das Formular verändert wurde (Geltungsbereich unten) |

**Geltungsbereich der letzten Zeile.** Gemeint ist zunächst jeder Weg, den
die Ansicht **selbst** auslöst: ein Knopf, der navigiert, ein Wechsel in
einen anderen Bereich, ein Abbruch mit Datenverlust. Ein Wächter über
**jede** Navigation (Breadcrumb, Kopfleiste, Zurück-Knopf des Browsers)
braucht `useBlocker` und damit einen Data-Router in Anwendung *und*
Testhülle; das ist eigene Arbeit und gehört ausdrücklich ins Ticket, wenn
es verlangt wird. Was nicht bewacht ist, wird im Übergabekommentar benannt,
statt als erledigt zu gelten. Ebenso gilt: ein Formular, dessen Stand
gespeichert wurde, ist **nicht mehr verändert** (`form.reset` nach dem
Speichern); sonst fragt die Rückfrage ohne Anlass und wird zur Gewohnheit,
die man wegklickt.

Die Rückfrage ersetzt keine Serverprüfung: sie ist Bequemlichkeit, die
Rechte- und Statusregeln entscheidet der Server (§4.1, §5). Und sie ersetzt
keine Rückmeldung danach: der Ausgang wird angesagt, und zwar dort, wo er
nach der Handlung noch steht. Verschwindet das Element mitsamt seiner
Meldung, gehört die Live-Region eine Ebene höher (Befund aus KAN-69).

## 6. Responsiv, in rem, und das Template ist die Messlatte

- **Die fertige Fläche wird gegen das Figma-Template gehalten**, nicht
  gegen die Erinnerung daran (Skill `frontend-modul`, Abschnitt 0a).
  Anordnung, Bausteine, Beschriftungen und Radien stimmen mit dem Template
  überein; Abweichungen sind entschiedene Fragen, keine Auslegungssache.
- **Maße in rem.** Die Tailwind-Utilities sind rem-basiert und die richtige
  Wahl; ein freier px-Wert (`w-[320px]`, eigenes CSS mit px) ist ein
  Befund. px bleibt für Haarlinien und px-basierte Token (Radius).
- Tabellen und breite Inhalte scrollen in ihrem eigenen Bereich. Die Seite
  selbst scrollt nie waagerecht.
- Ab 360 Pixel Breite bedienbar; das Template zeigt nur Desktop, die
  Responsivität ist trotzdem Pflicht.
- Die Admin-Tabellen sind der schwierigste Fall: lieber je Zeile eine Karte
  auf schmalen Bildschirmen als eine gequetschte Tabelle.

## 7. Definition of Done

- [ ] Keine Hex-Farbe außerhalb von `frontend/src/styles/tokens/`
- [ ] Jede Primitive unter `components/ui/` per CLI erzeugt, keine von Hand
      angelegt oder inhaltlich verändert (Skill `frontend-shadcn`)
- [ ] Komponente in hell und dunkel geprüft
- [ ] Enum-Anzeige über i18n-Schlüssel, nicht über Literale; Schlüssel in
      `de.json` und `en.json`
- [ ] Vollständig mit der Tastatur bedienbar, Fokus sichtbar
- [ ] Jedes Feld beschriftet, jede Symbolschaltfläche benannt
- [ ] Überschriftenebenen ohne Sprung, über `getByRole("heading", { level })`
      nachgewiesen statt über `getByText`; die Ebene setzt die Domänenhülle
- [ ] Jede Zustandsregel in CSS deckt neben `:disabled` auch `aria-disabled`
      ab (Base UI meldet Zustände über ARIA)
- [ ] Jede Handlung mit Folgen (Abschnitt 5) fragt über `alert-dialog` nach,
      benennt den Gegenstand im Text und meldet ihren Ausgang an einer
      Stelle, die danach noch sichtbar ist
- [ ] Kontrast geprüft, Abweichungen im Token korrigiert
- [ ] Kein waagerechtes Scrollen der Seite auf 360 Pixel
- [ ] Verbleibende Einschränkungen benannt, nicht verschwiegen
