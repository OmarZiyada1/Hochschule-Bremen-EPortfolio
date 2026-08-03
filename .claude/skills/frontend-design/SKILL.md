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

Alle Farbwerte liegen in `frontend/src/styles/tokens/colors.css` und sind
über den `@theme inline`-Block als Tailwind-Utilities verfügbar.

**Eine Hex-Farbe außerhalb von `frontend/src/styles/tokens/` ist ein
Befund.** Auch in einer Komponente, auch „nur kurz", auch im Diagramm.
Sonst gibt es das HSB-Blau in vier Nuancen und niemand weiß, welche gilt.

Vorhandene Gruppen:

| Gruppe | Beispiele | Themenabhängig |
| --- | --- | --- |
| Marke | `--brand-blue-dark`, `--brand-blue`, `--brand-tuerkis` | nein |
| Fakultät | `--faculty-f1` bis `--faculty-f5` | nein |
| Fläche und Text | `--surface-page`, `--text-primary`, `--border-subtle` | ja |
| Status | `--status-draft-bg` bis `--status-revision-fg` | ja |
| Rolle | `--role-studierende-bg` bis `--role-admin-fg` | ja |

Marken- und Fakultätsfarben bleiben in hell und dunkel gleich, weil sie
Identität tragen. Alles andere hat einen abgeleiteten dunklen Wert.

Das Figma-Design ist nur hell angelegt. Neue dunkle Werte werden abgeleitet
und auf Kontrast geprüft, nicht geschätzt.

## 2. Wo eine Komponente wohnt

| Ort | Was dort hingehört |
| --- | --- |
| `components/ui/` | shadcn/Base-UI-Primitiven, per CLI erzeugt, Bibliotheksnamen unverändert |
| `components/layout/` | NavBar, Footer, Breadcrumb |
| `components/common/` | alles mit Domänenbezug: `ProjectCard`, `StatusBadge`, `RoleBadge`, `EmptyState`, `KpiTile` |
| `features/<feature>/components/` | nur in diesem Feature verwendet |

Wird ein Baustein von der zweiten Seite gebraucht, wandert er nach oben,
statt kopiert zu werden. Zwei Fassungen derselben Projektkachel driften
zuverlässig auseinander.

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
- **Kontrast:** 4.5:1 für Text, 3:1 für Bedienelemente, in hell **und**
  dunkel. Betroffen sind vor allem die Status- und Rollenpillen.
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
- [ ] Komponente in hell und dunkel geprüft
- [ ] Enum-Anzeige über i18n-Schlüssel, nicht über Literale; Schlüssel in
      `de.json` und `en.json`
- [ ] Vollständig mit der Tastatur bedienbar, Fokus sichtbar
- [ ] Jedes Feld beschriftet, jede Symbolschaltfläche benannt
- [ ] Überschriftenebenen ohne Sprung
- [ ] Kontrast geprüft, Abweichungen im Token korrigiert
- [ ] Kein waagerechtes Scrollen der Seite auf 360 Pixel
- [ ] Verbleibende Einschränkungen benannt, nicht verschwiegen
