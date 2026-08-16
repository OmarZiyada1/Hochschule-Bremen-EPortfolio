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

### Die Falle heißt „das ist doch nur Markup"

Registry-Entsprechungen haben nicht nur interaktive Bausteine. Auch
strukturelle Primitiven ohne eigene Logik stehen in der Registry: `empty`,
`field`, `card`, `alert`, `skeleton`, `separator`, `breadcrumb`. Eine
Fläche, die nach „nur Überschrift plus Text plus Link" aussieht, ist fast
immer ein Leerzustand und kommt aus `empty` beziehungsweise der Domänenhülle
`EmptyState`; das gilt ausdrücklich für Fehler- und Zustandsseiten (404,
Kein Zugriff, „Inhalt folgt"). In KAN-7 sind die 404- und die
Kein-Zugriff-Seite zunächst als handgebaute h1+p+Link-Struktur entstanden,
obwohl `empty` installiert war; der Verstoß fiel erst im menschlichen
Review auf, weil jede Beispielliste nur interaktive Bausteine nannte.

Daraus folgen zwei Pflichten vor **jeder** neuen Datei, die sichtbare
Struktur rendert, auch unter `features/` und `routes/`, nicht nur unter
`components/`:

1. **Inventar zuerst.** `frontend/src/components/ui/` und
   `frontend/src/components/common/` ansehen und benennen, welcher
   vorhandene Baustein die Fläche trägt oder warum keiner passt; bei
   Zweifel `pnpm dlx shadcn@latest search @shadcn -q <text>`. „Sieht nach
   einfachem Markup aus" ist keine Antwort auf diese Frage.
2. **Eine fast passende Domänenhülle wird erweitert, nicht umgangen.**
   Konnte `EmptyState` in KAN-7 nur die Überschriftenebenen 2 und 3, die
   Seite brauchte aber 1, dann ist das ein Grund, die Hülle zu erweitern,
   kein Grund, daneben zu bauen. Erst wenn die Hülle die Anforderung
   strukturell nicht darstellt (in KAN-7: Markenkachel und Fehlercode
   zugleich), komponiert die Seite die Primitive direkt, wie
   `features/not-found/NotFoundPage.tsx`.

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
mit der Tokenschicht und werden **nicht als Block übernommen**. Genau deshalb
steht ein zweites `init` auf der Rücksprache-Liste in Abschnitt 5.

Das Preset pauschal zu verwerfen, hat in KAN-29 allerdings eine Lücke
hinterlassen: `--radius` fiel mit weg, und `input-group.tsx` rechnet damit.
`src/index.css` enthält deshalb die vier Imports **und** die wenigen
shadcn-Basisvariablen, die eine erzeugte Komponente nachweislich braucht,
einzeln nachgetragen statt pauschal übernommen (Abschnitt 6).

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

Erlaubt sind **vier** Eingriffe, und alle vier haben denselben Grund: die
Registry setzt etwas voraus, das in diesem Projekt anders geregelt ist.
Alles andere bleibt, wie die CLI es geschrieben hat.

| Eingriff | Erlaubt |
| --- | --- |
| Englisches Literal durch i18n ersetzen | **ja**, und zwar sofort beim Erzeugen |
| Hartkodierten Wert auf die **vorhandene** Rolle ziehen (`bg-black/10` nach `bg-overlay`) | **ja**, siehe unten |
| Nachweisbaren Barrierefreiheitsfehler beheben (fehlender zugänglicher Name, `aria-hidden` über einem `sr-only`-Text) | **ja** |
| Was den Build unter unseren Compileroptionen bricht, minimal geradeziehen (ungenutzter Import gegen `noUnusedLocals`) | **ja**, so klein wie möglich |
| Dateiname ändern (`button.tsx` nach `Button.tsx`) | nein |
| Export- oder Komponentennamen ändern | nein |
| Eine Klasse durch einen **eigenen** Farbwert ersetzen | nein, stattdessen fehlende Rolle ergänzen (Abschnitt 8) |
| Eine neue `cva`-Variante hinzufügen | nein in `components/ui/`, ja in der Domänenkomponente daneben |
| Logik oder Props umbauen | nein, dann ist es eine eigene Komponente an eigener Stelle |

Jeder tatsächlich vorgenommene Eingriff wird im Übergabekommentar des Tickets
je Datei benannt. Nur so lässt sich der Bericht aus `add --diff` später lesen:
er meldet dann nicht mehr „No changes", sondern **genau die aufgeschriebenen**
Abweichungen. Eine Abweichung, die dort auftaucht und nirgends benannt ist,
ist ein Befund.

### Rolle fehlt oder Rolle wird umgangen: zwei Fälle, zwei Richtungen

Diese beiden sehen sich ähnlich und werden gegenläufig aufgelöst. Wer sie
verwechselt, macht aus einer Zeile Arbeit einen Konflikt beim nächsten `add`.

| Fall | Was die Komponente tut | Auflösung |
| --- | --- | --- |
| Die Rolle **fehlt** | `bg-sidebar-primary`, und `--sidebar-primary` gibt es nicht | Rolle in `tokens.css` ergänzen. **Komponentencode bleibt** (Abschnitt 8) |
| Die Rolle **existiert und wird umgangen** | `bg-black/10`, obwohl `--overlay` mit geprüften Werten dasteht | Klasse auf die Rolle ziehen. **Tokenschicht bleibt** |

Der Unterschied ist nicht Geschmack. Im ersten Fall zeigt die Komponente auf
eine Adresse, die es geben soll; dann wird die Adresse angelegt. Im zweiten
Fall zeigt sie an einer vorhandenen Adresse vorbei auf einen Rohwert, und den
kann die Tokenschicht nicht einholen: ein `--color-black` nachzutragen, damit
`bg-black/10` etwas trifft, macht die Klasse wirksam und den Entwurf trotzdem
falsch. Genau das ist in KAN-29 passiert. Im dunklen Modus liegt die Rolle
`overlay` bei 70 Prozent, `bg-black/10` bei 10 Prozent über ohnehin dunklem
Grund: der Dialog stand praktisch ohne Abdunkelung da, und die eigens dafür
entworfene Rolle war tot. `tokens.test.ts` verbietet seitdem `bg-black` und
`bg-white` unter `components/ui/`.

### Die Registry rechnet mit Variablen, die es hier nicht gibt

shadcn leitet Maße aus eigenen Basisvariablen ab, allen voran `--radius`. In
`input-group.tsx` steht `rounded-[calc(var(--radius)-3px)]`. Ist `--radius`
nirgends definiert, ist das `calc()` ungültig, die Deklaration fällt heraus,
und die Ecken bleiben eckig. **Kein Compilerfehler, keine Lint-Warnung, kein
roter Test**, derselbe stille Fehlermodus wie bei der fehlenden Brückenzeile
in Abschnitt 7.

Solche Variablen gehören nach `src/index.css` und nicht in `tokens.css`: dort
stehen ausschließlich Werte aus der Figma-Collection (Abschnitt 4). `index.css`
ist die in `components.json` hinterlegte Adresse und damit die Stelle, an der
ein fremder Wert als fremder Wert erkennbar bleibt.

```css
/* src/index.css, nach den Imports */
:root {
  --radius: var(--radius-control); /* 8px */
}
```

Dass die Ableitungen daraus (5px, 3px) neben der Sechserskala liegen, ist
hinzunehmen: es gibt keinen Startwert, der beide auf eine Figma-Stufe legt.
Die Skala bindet die Flächen, die wir selbst setzen, nicht die Innenteile
einer Registry-Datei. Die Alternative wäre, `input-group.tsx` umzuschreiben,
und das ist der teurere Verstoß.

Geprüft wird das nicht mehr von Hand: `tokens.test.ts` liest jede
`var(--…)`-Verwendung unter `components/ui/` und verlangt eine Definition in
der Tokenschicht oder in `index.css`. Ausgenommen sind nur Variablen, die die
Datei selbst setzt, und zwar in beiden Schreibweisen, als CSS-Deklaration
(`--cell-radius:` in `calendar.tsx`) und als `style`-Prop im JSX
(`"--gap": spacing` in `toggle-group.tsx`).

### Die i18n-Falle

Generierte Komponenten bringen sichtbare **englische Literale** mit. Das
kollidiert direkt mit Frontend-Regel 7 („kein Oberflächentext im Code") und
fällt sonst erst auf, wenn es in einem Screenshot in der Thesis steht.

Bekannt sind unter anderem `pagination` („Previous", „Next", „More pages")
und `sheet` („Close"). **Verlass dich nicht auf diese Liste.** Nach jedem
`add` einmal über die neuen Dateien suchen, etwa nach `sr-only` und nach
Textknoten in Großschreibung, und jeden Fund auf einen i18n-Schlüssel legen.
Die neuen Schlüssel kommen in `de.json` **und** `en.json`.

**Übersetzt ist nicht dasselbe wie hörbar.** `pagination` und `breadcrumb`
liefern ihren `sr-only`-Text in einem Element, das selbst `aria-hidden`
trägt; das nimmt den ganzen Teilbaum aus dem Accessibility-Baum. In KAN-29
sind so zwei sauber gepflegte Schlüssel entstanden, die kein Screenreader je
vorliest. Der Fehler überlebt jeden naheliegenden Test, weil der Text im DOM
steht und `getByText` ihn findet.

Deshalb gilt zu jedem neuen `sr-only`-Text zweierlei:

1. `aria-hidden` gehört an das Symbol, nicht an die Hülle darum.
2. Der Test prüft die **Erreichbarkeit**, nicht die Existenz:

```ts
expect(screen.getByText("Weitere Seiten").closest("[aria-hidden]")).toBeNull()
```

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

- **`Record` über den Enum-Typ, keine Funktion mit Standardzweig.** Ein
  sechster Status bricht den Typecheck, sobald er **im Typ** steht. Ein
  `default: "bg-muted"` fiele dagegen still auf Grau zurück, und niemand
  merkt es. Wichtig ist der Zusatz „im Typ": Solange `ProjectStatus` von Hand
  im Frontend geführt wird, trägt die Zusage nur so weit, wie jemand den Wert
  nachträgt. Erst wenn der Typ aus der generierten `schema.d.ts` kommt
  (Frontend-Regel 2), greift sie gegen den Contract selbst. Wer sie vorher in
  einen Kommentar schreibt, verspricht mehr, als der Code hält.
- **Das Badge trägt sein eigenes `-fg`**, nie `muted-foreground`. Das sieht
  fast gleich aus, verliert aber die geprüfte Kontrastzusage.

## 7. Die Tokenbrücke, und warum ohne sie alles still falsch aussieht

`tokens.css` schaltet mit `@theme { --color-*: initial; --radius-*: initial; }`
die Tailwind-Standardskalen ab, damit jede Farbe über eine Semantic-Rolle
läuft. Generierte Komponenten benutzen aber `rounded-sm`, `rounded-md`,
`rounded-lg` und `rounded-xl`.

Die Brücke im `@theme static`-Block hängt shadcns Namen auf die
Figma-Stufen (KAN-6, Abschnitt 3.3; `--radius-4xl` seit KAN-29; Zuordnung
seit dem Review zu KAN-8 nach der tatsächlichen Verwendung statt nach
Namensähnlichkeit):

```css
--radius-sm: var(--radius-selection);   /*  4px */
--radius-md: var(--radius-control);     /*  8px */
--radius-lg: var(--radius-control);     /*  8px, Eingabefelder und Buttons */
--radius-xl: var(--radius-card);        /* 12px, Karten */
--radius-4xl: var(--radius-pill);       /* 9999px */
```

`rounded-lg` sitzt in der Registry an Eingabefeldern und Buttons, die in
Figma 8px tragen, `rounded-xl` an Karten mit 12px; deshalb zeigen `md` und
`lg` beide auf `control`. Die Stufe `modal` (16px) hat keine Brückenzeile:
eine modale Fläche setzt `rounded-modal` als `className` an der
Verwendungsstelle, nicht in der generierten Datei.

### Die Skala reicht weiter als die Brücke

shadcn leitet seine Radien aus einem einzelnen `--radius` ab und kommt dabei
auf **sieben** Stufen: `sm`, `md`, `lg`, `xl`, `2xl`, `3xl` und `4xl`. Unsere
Brücke deckt die ersten vier, dazu seit KAN-29 `4xl` als Alias auf
`--radius-pill` (das Badge der Registry nutzt `rounded-4xl` und ist in
Figma eine Pille). Für `rounded-2xl` und `rounded-3xl` gibt es weiterhin
keine Adresse, und wegen `--radius-*: initial` verschwinden diese Klassen
ersatzlos.

**Das ist kein Grund, Stufen auf Vorrat anzulegen** (Abschnitt 8: keine
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
- [ ] Für jede neue Datei mit sichtbarer Struktur (auch unter `features/`
      und `routes/`) benannt, welcher Baustein aus `components/ui/` oder
      `components/common/` sie trägt oder warum keiner passt; Zustands- und
      Meldungsflächen aus `empty`/`EmptyState` (Abschnitt 1)
- [ ] Keine fast passende Domänenhülle umgangen: erweitert statt daneben
      gebaut (Abschnitt 1)
- [ ] Vor jeder Verwendung Import und API per `shadcn view <item>` bzw.
      `shadcn docs <item>` nachgeschlagen; Importe nur aus
      `@/components/ui/…`, kein direkter `@base-ui/react`-Import außerhalb
      von `components/ui/`
- [ ] Jede Datei unter `components/ui/` per CLI erzeugt, keine von Hand
- [ ] Dateinamen und Exportnamen der Primitiven unverändert
- [ ] Kein englisches Literal aus einer generierten Datei sichtbar; jeder
      neue Schlüssel in `de.json` **und** `en.json`
- [ ] Jeder neue `sr-only`-Text nachweislich **erreichbar**, nicht nur
      vorhanden: `closest("[aria-hidden]")` ist `null` (Abschnitt 6)
- [ ] Keine Variante und keine Logik in einer generierten Datei geändert;
      Varianten liegen in der Domänenkomponente. Ein hartkodierter Wert wird
      auf die **vorhandene** Rolle gezogen, eine **fehlende** Rolle dagegen
      in `tokens.css` ergänzt (Abschnitt 6, Tabelle „zwei Fälle")
- [ ] Jeder vorgenommene Eingriff je Datei im Übergabekommentar benannt, damit
      `add --diff` gegen eine erwartete Liste gelesen werden kann
- [ ] `pnpm test` grün, insbesondere `tokens.test.ts`: keine undefinierte
      Variable unter `components/ui/`, kein `bg-black`/`bg-white`
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
