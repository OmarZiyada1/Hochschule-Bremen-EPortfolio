/**
 * Katalog der Tokenschicht (KAN-6, Abschnitt 8).
 *
 * Die Liste ist Daten, keine Darstellung: sie ist ohne Rendern pruefbar und
 * haelt die Zusage aus der Definition of Done fest, dass die Pruefflaeche
 * alle 70 Semantic-Rollen zeigt. Kommt eine Rolle in tokens.css dazu und
 * hier nicht, faellt das im Test auf und nicht erst im Entwurf.
 *
 * Die Namen sind die CSS-Variablen ohne die beiden fuehrenden Bindestriche
 * und entsprechen eins zu eins der Figma-Collection "Semantic".
 */

export type TokenGroupId =
  | "surface"
  | "interaction"
  | "sidebar"
  | "status"
  | "role"
  | "badge"
  | "brand"
  | "cover"
  | "nav"
  | "feedback"

export type TokenGroup = {
  id: TokenGroupId
  tokens: readonly string[]
}

/** Semantic-Rollen nach Abschnitten der Confluence-Seite "Foundation". */
export const colorGroups: readonly TokenGroup[] = [
  {
    id: "surface",
    tokens: [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "overlay",
      "muted",
      "muted-foreground",
      "text-disabled",
      "text-placeholder",
    ],
  },
  {
    id: "interaction",
    tokens: [
      "primary",
      "primary-foreground",
      "primary-hover",
      "secondary",
      "secondary-foreground",
      "accent",
      "accent-foreground",
      "destructive",
      "destructive-foreground",
      "destructive-hover",
      "border",
      "input",
      "ring",
      "ring-offset",
    ],
  },
  {
    id: "sidebar",
    tokens: [
      "sidebar",
      "sidebar-foreground",
      "sidebar-accent",
      "sidebar-border",
    ],
  },
  {
    id: "status",
    tokens: [
      "status-draft-bg",
      "status-draft-fg",
      "status-submitted-bg",
      "status-submitted-fg",
      "status-approved-bg",
      "status-approved-fg",
      "status-published-bg",
      "status-published-fg",
      "status-revision-bg",
      "status-revision-fg",
    ],
  },
  {
    id: "role",
    tokens: [
      "role-student-bg",
      "role-student-fg",
      "role-editor-bg",
      "role-editor-fg",
      "role-admin-bg",
      "role-admin-fg",
    ],
  },
  {
    id: "badge",
    tokens: [
      "badge-neutral-bg",
      "badge-neutral-fg",
      "pill-info-bg",
      "pill-info-fg",
      "pill-success-bg",
      "pill-success-fg",
      "pill-warning-bg",
      "pill-warning-fg",
      "pill-danger-bg",
      "pill-danger-fg",
    ],
  },
  {
    id: "brand",
    tokens: [
      "surface-brand",
      "surface-brand-foreground",
      "surface-highlight",
      "surface-brand-muted",
    ],
  },
  {
    id: "cover",
    tokens: [
      "cover",
      "cover-foreground",
      "cover-muted",
      "cover-badge",
      "cover-scrim",
    ],
  },
  { id: "nav", tokens: ["nav", "nav-foreground"] },
  {
    id: "feedback",
    tokens: ["warning", "warning-foreground", "success", "success-foreground"],
  },
]

/**
 * Die beiden Rollen, die einen Verlauf tragen und keine Farbe (KAN-29).
 *
 * Die Pruefflaeche braucht die Unterscheidung, weil eine Musterflaeche den
 * Wert sonst als background-color setzt und ein Verlauf dort nichts ergibt:
 * das Feld bliebe leer, ohne dass etwas es meldet.
 */
export const gradientTokens: readonly string[] = ["cover", "nav"]

/**
 * Alle Semantic-Rollen in einer Liste, in der Reihenfolge der Gruppen.
 *
 * Bewusst eine Funktion und keine berechnete Konstante: ein Aufruf auf
 * Modulebene gilt dem Buendler als moeglicher Nebeneffekt, und die Liste
 * landete dann im Produktions-Bundle, obwohl die Pruefflaeche dort gar
 * nicht existiert.
 */
export function flattenColorTokens(): string[] {
  return colorGroups.flatMap((group) => [...group.tokens])
}

/**
 * Die sechs Radius-Stufen aus Foundation, Abschnitt 7. Die vier
 * Bruecken-Namen (radius-sm bis radius-xl) stehen bewusst nicht hier: sie
 * sind eine zweite Adresse fuer dieselben Werte und keine eigene Stufe.
 */
export const radiusTokens: readonly string[] = [
  "radius-none",
  "radius-selection",
  "radius-control",
  "radius-card",
  "radius-modal",
  "radius-pill",
]

/**
 * Schriftrollen als Klassennamen aus typography-tokens.css. Sie werden auf
 * der Pruefflaeche mit umbrechendem Text gezeigt: eine zu enge Zeilenhoehe
 * faellt an einer einzeiligen Beispielzeile nicht auf.
 */
export const typographyRoles: readonly string[] = [
  "type-display",
  "type-title",
  "type-h1",
  "type-h2",
  "type-h3",
  "type-num-rank",
  "type-num-stat",
  "type-body-lg",
  "type-body",
  "type-body-sm",
  "type-caption",
  "type-overline",
  "type-nav-brand-lg",
  "type-nav-brand",
  "type-nav-item",
  "type-avatar-lg",
  "type-label-xs",
]

/** Varianten und Groessen der per CLI erzeugten Primitive components/ui/button.tsx. */
export const buttonVariantNames = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const

export const buttonSizeNames = ["xs", "sm", "default", "lg"] as const

export const buttonIconSizeNames = [
  "icon-xs",
  "icon-sm",
  "icon",
  "icon-lg",
] as const
