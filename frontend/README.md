# Frontend: E-Portfolio Hochschule Bremen

React 19, TypeScript, Vite, Tailwind 4 und shadcn/ui auf Radix UI.
Aufgesetzt mit KAN-6.

## Befehle

```bash
pnpm install
pnpm dev         # Entwicklungsserver
pnpm build       # Typpruefung und Produktions-Build
pnpm test        # Vitest
pnpm typecheck   # tsc -b
pnpm lint        # ESLint, keine Warnungen erlaubt
pnpm format      # Prettier
pnpm gen:api     # Typen aus /v3/api-docs erzeugen (Backend muss laufen)
```

Die Pruefflaeche der Tokenschicht liegt unter `/dev/tokens` und existiert
nur im Entwicklungs-Build.

## Wo was liegt

| Ordner                    | Inhalt                                                     |
| ------------------------- | ---------------------------------------------------------- |
| `src/styles/tokens/`      | Farben, Radien, Schrift. Die einzige Stelle mit Hex-Werten |
| `src/components/ui/`      | Primitiven aus der shadcn-CLI, nie von Hand geschrieben    |
| `src/components/common/`  | eigene Komponenten, die Primitiven zusammensetzen          |
| `src/features/<feature>/` | Seiten mit ihren Bausteinen und Hooks                      |
| `src/i18n/`               | `de.json` und `en.json`, Deutsch ist Standard              |

`src/index.css` ist der einzige CSS-Einstiegspunkt und die Datei, in die
die shadcn-CLI schreibt. Die Tokendateien bleiben davon unberuehrt.

## Regeln

Verbindlich sind `CLAUDE.md` im Wurzelverzeichnis und die Skills unter
`.claude/skills/frontend-*`. Kurz gefasst:

- Primitiven entstehen ueber `pnpm dlx shadcn@latest add <name>`, nie von Hand.
- Keine Hex-Farbe ausserhalb von `src/styles/tokens/`.
- Kein sichtbarer Text als Literal im JSX, jeder Schluessel in beiden Sprachen.
- Bezeichner englisch, Prosa deutsch.
