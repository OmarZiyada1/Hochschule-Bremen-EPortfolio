---
name: frontend-shadcn
description: Regeln für shadcn/ui im Frontend des E-Portfolio Hochschule Bremen (Primitiven per CLI statt von Hand, Basis Base UI, components.json, Tokenbrücke, erlaubte Eingriffe an generierten Dateien). Immer verwenden, bevor eine Datei unter frontend/src/components/ui/ entsteht oder angefasst wird, und bevor eine Komponente von Hand gebaut wird, für die es eine Registry-Entsprechung gibt.
---

# shadcn/ui im Projekt

Dieser Skill beantwortet genau eine Frage, und zwar bevor sie falsch
beantwortet wird: **kommt dieser Baustein aus der CLI oder aus der Hand?**

Alles zum Aussehen (Tokens, Kontrast, Barrierefreiheit) steht im Skill
`frontend-design`, alles zum Aufbau einer Ansicht im Skill `frontend-modul`.
Beide gelten hier unverändert weiter.

## 1. Die Grundregel

**Alles unter `frontend/src/components/ui/` entsteht über
`pnpm dlx shadcn@latest add <name>`.** Eine dort von Hand geschriebene Datei
ist ein Befund, auch wenn sie funktioniert und gut aussieht.

Drei Gründe, und der dritte wiegt am schwersten:

1. Sie fällt aus dem Abgleich mit der Registry heraus (`add --diff`,
   Abschnitt 5). Ein Sicherheits- oder Barrierefreiheitsfix dort erreicht sie
   nie.
2. Sie erfindet eine zweite Bauart neben der generierten. Nach fünf
   Komponenten gibt es zwei Konventionen und niemand weiß, welche gilt.
3. Sie baut Tastaturbedienung, Fokusfallen, ARIA-Rollen und
   Bildschirmleser-Ankündigungen nach, die Base UI bereits mitbringt. Das
   sieht im Browser richtig aus und ist es fast nie. Ein selbst gebautes
   Auswahlmenü bedient sich mit der Maus einwandfrei und ist mit der
   Tastatur unbrauchbar, und genau dieser Fehler fällt in keinem Test auf,
   den man selbst dazu schreibt.

**Von Hand gebaut wird nur, was Domänenwissen trägt**, und das *komponiert*
die Primitiven, statt sie zu ersetzen. `StatusBadge` kennt die fünf Werte aus
Contract §2.2; `badge` kennt sie nicht und soll sie nicht kennen.

Die Entscheidung in einem Satz: **Gibt es eine Registry-Entsprechung, wird sie
benutzt. Gibt es keine, wird eine Hülle darum gebaut, nicht daneben.**

## 2. shadcn ist keine Abhängigkeit im üblichen Sinn

Es gibt kein Paket `shadcn/ui`, aus dem eine Komponente importiert wird. Die
CLI kopiert Quelltext in das Repository; ab dem Moment gehört er dem Projekt
und wird eingecheckt wie eigener Code.

Daraus folgt praktisch:

- Ein `pnpm update` aktualisiert die Komponenten **nicht**. Aktualisiert wird
  bewusst über `add --diff` (Abschnitt 5) und ein eigenes Ticket.
- Was die CLI installiert, sind die Basis-Pakete darunter (`@base-ui/react`),
  Hilfsbibliotheken und `shadcn` selbst (siehe unten). Nur die stehen in
  `package.json`, nie eine einzelne Komponente.
- Ein Review liest die generierten Dateien wie eigenen Code. „Kommt von
  shadcn" ist keine Begründung dafür, dass etwas nicht geprüft wurde.

### Eine Zeile gehört doch dazu: `shadcn/tailwind.css`

Beim `init` trägt die CLI `@import "shadcn/tailwind.css"` in die globale
CSS-Datei ein und nimmt `shadcn` als Paket in die `package.json`. Kein
Laufzeit-Import, sondern eine Build-Abhängigkeit: der Import liefert die
gemeinsamen Tailwind-v4-Utilities, auf die generierte Komponenten bauen,
darunter die Zustandsvarianten `data-open:` und `data-closed:` und die
Accordion-Animation.

Die Reihenfolge in `src/index.css` ist damit:

```css
@import "tailwindcss";
@import "shadcn/tailwind.css";
/* danach erst die eigenen Token- und Themenschichten */
```

**Fehlt der Import, greift keine dieser Varianten, und nichts sagt es an:**
kein Compilerfehler, keine Lint-Warnung, kein roter Test. Ein geöffnetes
Menü sieht dann aus wie ein geschlossenes. Es ist derselbe Fehlermodus wie
bei der Tokenbrücke in Abschnitt 7 und wird genauso geprüft, nämlich am
gebauten CSS.

`eject` löst diesen Import auf und schreibt seinen Inhalt fest in die eigene
CSS-Datei. Das ist unumkehrbar und steht deshalb in der Tabelle in
Abschnitt 5.

## 3. Basis ist Base UI

shadcn setzt auf einer von drei Basisbibliotheken auf, wählbar beim `init`
über `--base`: `base` (Base UI), `radix` (Radix UI), `aria` (React Aria).

**Dieses Projekt nutzt Base UI** (Style `base-nova`, Laufzeitpaket
`@base-ui/react`; umgestellt mit KAN-61). Die ursprüngliche Wahl von Radix
aus KAN-6 Abschnitt 3.1 ist damit revidiert. Begründung: Seit Juli 2026 ist
Base UI Default und Empfehlung von shadcn, Doku und Registry führen die
Base-Fassung zuerst, und erste neue Komponenten (etwa Toast) erscheinen nur
noch für Base UI. Radix wird laut Changelog weiter unterstützt; der Wechsel
war eine Kurskorrektur zum günstigsten Zeitpunkt, als erst eine einzige
Primitive existierte.

Base UI ist zugleich die Voreinstellung der CLI. Die Wahl steckt trotzdem im
Code jeder erzeugten Komponente und in `components.json`; sie wird nicht je
Ticket neu getroffen und nicht nebenbei geändert. Ein Wechsel der Basis
heißt: sämtliche Primitiven neu erzeugen und vollständig nachprüfen, also
ein eigenes Ticket (so geschehen in KAN-61).

**Ein `init` über ein bestehendes Projekt hängt sein Preset-Theme an die
CSS-Datei aus `components.json` an**: Standardpalette in oklch, Geist-Schrift,
eigene Radius-Skala aus einem einzelnen `--radius`. Diese Anhänge kollidieren
mit der Tokenschicht und werden nicht übernommen; die vier Imports aus
Abschnitt 2 bleiben der gesamte Inhalt von `src/index.css`. Genau deshalb
steht ein zweites `init` auf der Rücksprache-Liste in Abschnitt 5.

**`migrate radix` wechselt keine Basis.** Der Befehl schreibt Imports aus
den Einzelpaketen `@radix-ui/react-*` auf das Sammelpaket `radix-ui` um und
ist in diesem Projekt gegenstandslos.

### Die Doku passt ohne Umweg

Die Beispiele in der Doku unterscheiden sich je Basis; die Web-Doku zeigt
die Base-UI-Fassung als Voreinstellung und passt damit zu diesem Projekt.
Im Projektordner gilt ohnehin die Basis aus `components.json`:

```bash
pnpm dlx shadcn@latest docs <item>
```

Nur für den bewussten Vergleich mit einer anderen Basis wird sie per
`-b radix` oder `-b aria` mitgegeben.

## 4. `components.json`

Die Datei liegt unter `frontend/components.json` und ist die einzige Stelle,
an der die CLI erfährt, wie das Projekt gebaut ist.

| Schlüssel | Wert | Warum genau der |
| --- | --- | --- |
| `style` | was das `init` einträgt | Kennung der Registry-Fassung, aus der `add` liest. Wird von der CLI gesetzt und nie von Hand geändert |
| `tailwind.config` | `""` | Tailwind v4 kennt keine Config-Datei |
| `tailwind.css` | `src/index.css` | **nicht** die Tokendatei, siehe unten |
| `tailwind.cssVariables` | `true` | Komponenten binden an Semantic-Rollen |
| `tailwind.baseColor` | `neutral` | nach dem `init` nicht mehr änderbar |
| `aliases.ui` | `@/components/ui` | |
| `aliases.utils` | `@/lib/utils` | dort liegt `cn()` |
| `iconLibrary` | `lucide` | `lucide-react` ist installiert |

**`tailwind.css` zeigt nie auf eine Datei unter `styles/tokens/`.** Bringt ein
Registry-Eintrag eigene CSS-Variablen mit, schreibt die CLI sie in genau die
dort genannte Datei. In `tokens.css` dürfen ausschließlich Werte aus der
Figma-Collection stehen; ein von der CLI eingefügtes `--radius: 0.625rem`
säße dort als scheinbar regulärer Figma-Wert und wäre beim nächsten Abgleich
nicht mehr als Fremdkörper zu erkennen.

## 5. Befehle

Vor jedem `add` gilt: erst sehen, dann erzeugen.

| Befehl | Wofür |
| --- | --- |
| `shadcn info` | Was die CLI im Projekt sieht: Framework, Tailwind-Version, Aliase, Basis, installierte Komponenten. Erster Befehl bei jedem Zweifel, statt `components.json` zu interpretieren |
| `shadcn search @shadcn -q <text>` | In der Registry suchen (`list` ist ein Alias). Klärt, ob es die Komponente schon gibt, bevor sie von Hand entsteht. Die Quelle ist ein Pflichtargument und trägt ein `@` |
| `shadcn view <item...>` | Quelltext ansehen, **bevor** er im Repository landet |
| `shadcn docs <item>` | API-Referenz und Anwendungshinweise, siehe Abschnitt 3 |
| `shadcn add <item...>` | Erzeugt die Komponenten samt ihrer Abhängigkeiten |
| `shadcn add --dry-run <item...>` | Zeigt, welche Dateien entstünden, ohne zu schreiben |
| `shadcn add --diff [pfad]` | Abweichungen zwischen lokaler Fassung und Registry |

Alle mit `pnpm dlx shadcn@latest` davor, ausgeführt in `frontend/`.

Mehrere Komponenten in **einem** `add` erzeugen, nicht nacheinander: die CLI
löst gemeinsame Abhängigkeiten dann einmal auf.

### Erst nachschlagen, dann verwenden: auch beim Import

Dieselbe Regel wie vor dem `add` gilt vor jeder **Verwendung** einer
Primitive im eigenen Code: Import, Exportnamen und Props werden in der
Registry nachgeschlagen und nicht aus dem Gedächtnis geschrieben.
`shadcn view <item>` zeigt den Quelltext samt Exporten, `shadcn docs
<item>` die Anwendungsbeispiele in der Base-UI-Fassung des Projekts. Die
Fassungen unterscheiden sich je Basis und je CLI-Version; ein aus einem
Blogpost übernommenes Beispiel importiert zuverlässig die falschen Namen.

Daraus folgen drei feste Regeln:

1. Importiert wird ausschließlich über die Aliase aus `components.json`,
   also `@/components/ui/<name>`; es gibt kein Paket `shadcn/ui`, aus dem
   sich etwas importieren ließe (Abschnitt 2).
2. Ein direkter Import aus `@base-ui/react` außerhalb von
   `components/ui/` ist ein Befund: er umgeht die generierte Hülle und
   damit Tokenanbindung, Varianten und i18n-Anpassungen.
3. Zusammengesetzte Primitiven (`dialog`, `select`, `field`) exportieren
   mehrere Bausteine; welche es sind und wie sie verschachtelt werden,
   sagt `view`/`docs`, nicht die Erinnerung an eine andere Version.

**Einen eigenständigen Befehl `shadcn diff` gibt es nicht.** Der Abgleich
hängt als Option an `add`, zusammen mit `--view` und `--dry-run`. Wer aus
älteren Anleitungen `shadcn diff` übernimmt, bekommt keinen leeren Bericht,
sondern einen Fehler. Ändert sich das in einer künftigen Fassung, entscheidet
`shadcn --help` im Projektordner, nicht diese Tabelle.

### Was nicht ohne Rücksprache läuft

| Befehl | Warum |
| --- | --- |
| `init` ein zweites Mal | schreibt `components.json` und die CSS-Datei neu und kann die Tokenanbindung überschreiben |
| `add --all` | zieht rund 60 Komponenten ins Repository, von denen die meisten nie benutzt werden. Jede ungenutzte Datei ist Pflegelast und Prüffläche im Review |
| `add --overwrite` ohne vorheriges `add --diff` | überschreibt die i18n-Anpassungen aus Abschnitt 6 stillschweigend |
| `apply <preset>` | spielt Theme, Schrift und Komponenten eines fremden Presets ein und überschreibt dabei die Tokenanbindung. `--only theme` und `--only font` sind nicht harmloser, sie treffen genau die Dateien aus Abschnitt 7 |
| `migrate …` (`icons`, `rtl`, `radix`) | schreibt alle Komponenten auf einmal um, gehört in ein eigenes Ticket |
| `eject` | irreversibel: löst `@import "shadcn/tailwind.css"` auf und koppelt das Projekt von künftigen Korrekturen daran ab (Abschnitt 2) |
| `add <URL>` oder eine neue Registry | eine neue Bezugsquelle für Code ist eine Abhängigkeitsentscheidung (`CLAUDE.md`, Frontend-Regel 9) |

`build` betrifft nur Projekte, die selbst eine Registry veröffentlichen.
Dieses tut das nicht.

## 6. Was an einer generierten Datei geändert werden darf

| Eingriff | Erlaubt |
| --- | --- |
| Englisches Literal durch i18n ersetzen | **ja**, und zwar sofort beim Erzeugen |
| Fehlenden zugänglichen Namen ergänzen (`aria-label`, `sr-only`) | ja |
| Dateiname ändern (`button.tsx` nach `Button.tsx`) | nein |
| Export- oder Komponentennamen ändern | nein |
| Eine Klasse durch einen eigenen Farbwert ersetzen | nein, stattdessen fehlende Rolle ergänzen (Abschnitt 8) |
| Eine neue `cva`-Variante hinzufügen | nein in `components/ui/`, ja in der Domänenkomponente daneben |
| Logik oder Props umbauen | nein, dann ist es eine eigene Komponente an eigener Stelle |

### Die i18n-Falle

Generierte Komponenten bringen sichtbare **englische Literale** mit. Das
kollidiert direkt mit Frontend-Regel 7 („kein Oberflächentext im Code") und
fällt sonst erst auf, wenn es in einem Screenshot in der Thesis steht.

Bekannt sind unter anderem `pagination` („Previous", „Next", „More pages")
und `sheet` („Close"). **Verlass dich nicht auf diese Liste.** Nach jedem
`add` einmal über die neuen Dateien suchen, etwa nach `sr-only` und nach
Textknoten in Großschreibung, und jeden Fund auf einen i18n-Schlüssel legen.
Die neuen Schlüssel kommen in `de.json` **und** `en.json`.

### Varianten gehören in die Domänenkomponente

`badge.tsx` bekommt keine Status-Varianten. Stattdessen:

```tsx
// components/common/StatusBadge.tsx
const statusClasses: Record<ProjectStatus, string> = {
	DRAFT:     "bg-status-draft-bg text-status-draft-fg",
	SUBMITTED: "bg-status-submitted-bg text-status-submitted-fg",
	APPROVED:  "bg-status-approved-bg text-status-approved-fg",
	PUBLISHED: "bg-status-published-bg text-status-published-fg",
	REVISION:  "bg-status-revision-bg text-status-revision-fg",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
	const { t } = useTranslation();
	return (
		<Badge className={statusClasses[status]}>
			{t(`project.status.${status}`)}
		</Badge>
	);
}
```

Zwei Dinge daran sind Absicht:

- **`Record` über den Enum-Typ, keine Funktion mit Standardzweig.** Kommt ein
  sechster Status in den Contract, bricht der Typecheck. Ein
  `default: "bg-muted"` fiele dagegen still auf Grau zurück, und niemand
  merkt es.
- **Das Badge trägt sein eigenes `-fg`**, nie `muted-foreground`. Das sieht
  fast gleich aus, verliert aber die geprüfte Kontrastzusage.

## 7. Die Tokenbrücke, und warum ohne sie alles still falsch aussieht

`tokens.css` schaltet mit `@theme { --color-*: initial; --radius-*: initial; }`
die Tailwind-Standardskalen ab, damit jede Farbe über eine Semantic-Rolle
läuft. Generierte Komponenten benutzen aber `rounded-sm`, `rounded-md`,
`rounded-lg` und `rounded-xl`.

Die Brücke im `@theme inline`-Block hängt shadcns Namen auf die sechs
Figma-Stufen (KAN-6, Abschnitt 3.3):

```css
--radius-sm: var(--radius-selection);   /*  4px */
--radius-md: var(--radius-control);     /*  8px */
--radius-lg: var(--radius-card);        /* 12px */
--radius-xl: var(--radius-modal);       /* 16px */
```

### Die Skala reicht weiter als die Brücke

shadcn leitet seine Radien aus einem einzelnen `--radius` ab und kommt dabei
auf **sieben** Stufen: `sm`, `md`, `lg`, `xl`, `2xl`, `3xl` und `4xl`. Unsere
Brücke deckt die ersten vier, weil die Figma-Collection dort endet. Für
`rounded-2xl` bis `rounded-4xl` gibt es also keine Adresse, und wegen
`--radius-*: initial` verschwinden diese Klassen ersatzlos.

**Das ist kein Grund, drei Stufen auf Vorrat anzulegen** (Abschnitt 8: keine
Rolle ohne Verwendung). Es ist ein Grund, sie zu bemerken. Deshalb nach jedem
`add` einmal über die neuen Dateien nach `rounded-` suchen. Taucht eine Stufe
oberhalb von `xl` auf, ist das ein Befund in der Tokenschicht und wird wie in
Abschnitt 8 aufgelöst: Stufe in `tokens.css` ergänzen, über `@theme inline`
anbinden, in Figma und auf der Confluence-Seite „Foundation" nachziehen. Der
Komponentencode wird auch hier nicht angefasst.

**Eine Utility-Klasse ohne Wirkung erzeugt keinen Fehler.** Kein Compilerfehler,
keine Lint-Warnung, kein roter Test. Die Komponente sieht nur falsch aus, und
wer sie nicht gegen den Entwurf hält, merkt nichts.

Prüfen lässt sich das nach `pnpm build` im erzeugten CSS unter
`dist/assets/`: fehlt dort ein Selektor `.rounded-md`, greift die Klasse
nirgends. Dasselbe gilt für Farbklassen, weil `--color-*: initial` auch
Schlüsselwerte wie `white` und `black` entfernt.

Merksatz: **Eine Klasse, die im gebauten CSS nicht vorkommt, ist ein Befund
in der Tokenschicht, nicht in der Komponente.**

## 8. Fehlt eine Semantic-Rolle, wird die Rolle ergänzt

Erzeugte Komponenten erwarten Rollen, die die Figma-Collection heute nicht
führt, zum Beispiel `--sidebar-primary`, `--sidebar-accent-foreground`,
`--sidebar-ring` oder `--chart-1` bis `--chart-5`.

Dann gilt in dieser Reihenfolge:

1. Rolle in `tokens.css` ergänzen, hell **und** dunkel, als Alias auf eine
   vorhandene Primitive.
2. Über `@theme inline` anbinden.
3. Kontrast gegen die tatsächlich sichtbare Fläche prüfen.
4. In Figma und auf der Confluence-Seite „Foundation" nachziehen, damit
   Design und Code nicht auseinanderlaufen.

**Der Komponentencode wird dabei nicht angefasst.** Wer im generierten Code
`bg-sidebar-primary` durch `bg-primary` ersetzt, koppelt die Komponente von
der CLI ab und handelt sich beim nächsten `add` oder `add --diff` einen
Konflikt ein. Der Aufwand ist derselbe, das Ergebnis schlechter.

Keine Rolle auf Vorrat anlegen: eine Rolle ohne Verwendung fliegt nach
derselben Regel wieder raus wie eine Primitive ohne Semantic-Referenz
(Skill `frontend-design`, Abschnitt 1).

## 9. Registry und Namespaces

Die Registry ist das Verteilsystem hinter der CLI: eine `registry.json` je
Quelle, aus der Einträge samt Abhängigkeiten, CSS-Variablen und Dateien
geladen werden. `components.json` kann unter `registries` weitere Quellen
unter einem Namensraum führen (`@namespace/item`).

**Dieses Projekt betreibt keine eigene Registry und bezieht aus keiner
fremden.** Eine zusätzliche Quelle einzutragen heißt, Code aus einer neuen
Herkunft ins Repository zu lassen, und ist damit eine Abhängigkeitsentscheidung
nach `CLAUDE.md`, Frontend-Regel 9: vorher fragen, nicht nebenbei eintragen.

## 10. Definition of Done

- [ ] Vor dem ersten `add` geprüft, ob es die Komponente in der Registry gibt
      (`shadcn search`), statt sie von Hand zu bauen
- [ ] Vor jeder Verwendung Import und API per `shadcn view <item>` bzw.
      `shadcn docs <item>` nachgeschlagen; Importe nur aus
      `@/components/ui/…`, kein direkter `@base-ui/react`-Import außerhalb
      von `components/ui/`
- [ ] Jede Datei unter `components/ui/` per CLI erzeugt, keine von Hand
- [ ] Dateinamen und Exportnamen der Primitiven unverändert
- [ ] Kein englisches Literal aus einer generierten Datei sichtbar; jeder
      neue Schlüssel in `de.json` **und** `en.json`
- [ ] Keine Farbe, keine Variante und keine Logik in einer generierten Datei
      geändert; Varianten liegen in der Domänenkomponente
- [ ] Enum-Zuordnungen als `Record` über den Enum-Typ, ohne Standardzweig
- [ ] Fehlende Semantic-Rollen ergänzt statt Komponentencode umgeschrieben,
      Nachtrag in Figma und Foundation benannt
- [ ] Nach `pnpm build` stichprobenhaft geprüft, dass die verwendeten
      `rounded-*` und Farbklassen im erzeugten CSS vorkommen; jede Stufe
      oberhalb von `rounded-xl` als Befund behandelt (Abschnitt 7)
- [ ] `@import "shadcn/tailwind.css"` steht in `src/index.css`; die
      Zustandsvarianten (`data-open:`, `data-closed:`) greifen sichtbar
- [ ] Keine neue Registry-Quelle und kein `--all`, `--overwrite`, `apply`,
      `migrate` oder `eject` ohne Absprache
- [ ] Jede erzeugte und jede komponierte Komponente in hell und dunkel
      angesehen, Tastaturbedienung und Fokusring geprüft
