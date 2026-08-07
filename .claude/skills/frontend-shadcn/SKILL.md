---
name: frontend-shadcn
description: Regeln für shadcn/ui im Frontend des E-Portfolio Hochschule Bremen (Primitiven per CLI statt von Hand, Basis Radix UI, components.json, Tokenbrücke, erlaubte Eingriffe an generierten Dateien). Immer verwenden, bevor eine Datei unter frontend/src/components/ui/ entsteht oder angefasst wird, und bevor eine Komponente von Hand gebaut wird, für die es eine Registry-Entsprechung gibt.
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

1. Sie fällt aus `shadcn diff` heraus. Ein Sicherheits- oder
   Barrierefreiheitsfix in der Registry erreicht sie nie.
2. Sie erfindet eine zweite Bauart neben der generierten. Nach fünf
   Komponenten gibt es zwei Konventionen und niemand weiß, welche gilt.
3. Sie baut Tastaturbedienung, Fokusfallen, ARIA-Rollen und
   Bildschirmleser-Ankündigungen nach, die Radix bereits mitbringt. Das
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

Es gibt kein Paket `shadcn/ui`, das zur Laufzeit importiert wird. Die CLI
kopiert Quelltext in das Repository; ab dem Moment gehört er dem Projekt und
wird eingecheckt wie eigener Code.

Daraus folgt praktisch:

- Ein `pnpm update` aktualisiert die Komponenten **nicht**. Aktualisiert wird
  bewusst über `shadcn diff` und ein eigenes Ticket.
- Was die CLI installiert, sind die Basis-Pakete darunter (`radix-ui`) und
  gegebenenfalls Hilfsbibliotheken. Nur die stehen in `package.json`.
- Ein Review liest die generierten Dateien wie eigenen Code. „Kommt von
  shadcn" ist keine Begründung dafür, dass etwas nicht geprüft wurde.

## 3. Basis ist Radix UI

shadcn setzt auf einer von drei Basisbibliotheken auf, wählbar beim `init`
über `--base`: `base` (Base UI), `radix` (Radix UI), `aria` (React Aria).

**Dieses Projekt nutzt Radix UI** (`shadcn init --base radix`, festgelegt in
KAN-6 Abschnitt 3.1). Begründung: reifste der drei Basen, breiteste Doku,
längste Historie in Sachen Barrierefreiheit, und damit in der Thesis am
leichtesten zu belegen.

Die Wahl steckt im Code jeder erzeugten Komponente. Sie wird nicht je Ticket
neu getroffen und nicht nebenbei geändert; ein Wechsel ist ein eigenes Ticket
mit `shadcn migrate radix` und vollständiger Nachprüfung.

Beim Nachschlagen in der shadcn-Doku darauf achten, dass die
Radix-Fassung gelesen wird. Die Beispiele unterscheiden sich je Basis.

## 4. `components.json`

Die Datei liegt unter `frontend/components.json` und ist die einzige Stelle,
an der die CLI erfährt, wie das Projekt gebaut ist.

| Schlüssel | Wert | Warum genau der |
| --- | --- | --- |
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
| `shadcn search --query <text>` | In der Registry suchen (`list` ist ein Alias). Klärt, ob es die Komponente schon gibt, bevor sie von Hand entsteht |
| `shadcn view <item>` | Quelltext ansehen, **bevor** er im Repository landet |
| `shadcn docs <item>` | API-Referenz und Anwendungshinweise zur Komponente |
| `shadcn add <item...>` | Erzeugt die Komponenten samt ihrer Abhängigkeiten |
| `shadcn diff` | Abweichungen zwischen lokaler Fassung und Registry |

Alle mit `pnpm dlx shadcn@latest` davor, ausgeführt in `frontend/`.

Mehrere Komponenten in **einem** `add` erzeugen, nicht nacheinander: die CLI
löst gemeinsame Abhängigkeiten dann einmal auf.

### Was nicht ohne Rücksprache läuft

| Befehl | Warum |
| --- | --- |
| `init` ein zweites Mal | schreibt `components.json` und die CSS-Datei neu und kann die Tokenanbindung überschreiben |
| `add --all` | zieht rund 60 Komponenten ins Repository, von denen die meisten nie benutzt werden. Jede ungenutzte Datei ist Pflegelast und Prüffläche im Review |
| `add --overwrite` ohne vorheriges `diff` | überschreibt die i18n-Anpassungen aus Abschnitt 6 stillschweigend |
| `migrate …` | verändert alle Komponenten auf einmal, gehört in ein eigenes Ticket |
| `eject` | irreversibel |
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
der CLI ab und handelt sich beim nächsten `add` oder `diff` einen Konflikt
ein. Der Aufwand ist derselbe, das Ergebnis schlechter.

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
      `rounded-*` und Farbklassen im erzeugten CSS vorkommen
- [ ] Keine neue Registry-Quelle und kein `--all`, `--overwrite`, `migrate`
      oder `eject` ohne Absprache
- [ ] Jede erzeugte und jede komponierte Komponente in hell und dunkel
      angesehen, Tastaturbedienung und Fokusring geprüft
