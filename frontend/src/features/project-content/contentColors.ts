/**
 * Die neun Farbrollen fuer Inhaltsblocke (Contract 2.5, seit v63).
 *
 * <p>Ein farbiger Textabschnitt speichert einen <strong>Rollennamen</strong>
 * und keinen Hex-Wert: {@code { "type": "textStyle", "attrs": { "color":
 * "red" } }}. Ein eingebrannter Hex-Wert waere im Dunkelmodus derselbe Ton
 * auf dunklem Grund und verfehlte den Kontrast von 4,5:1 (SC 1.4.3); er
 * laege ausserdem ausserhalb der Tokenschicht (Frontend-Regel 5) und liesse
 * sich nachtraeglich nur per Migration aendern.
 *
 * <p>Diese Datei ist die einzige Stelle, an der Rollenname und Token
 * zusammenstehen. Der Farbwaehler der Auswahlleiste (KAN-36) und der
 * Renderer lesen sie von hier; eine gleichnamige Datei unter einem anderen
 * Pfad waere eine zweite Wahrheit. Sichtbar wird die Farbe ueber das
 * Attribut {@code data-color} und die Regeln in
 * {@code styles/project-content.css}: dieselbe Regel traegt den Renderer und
 * die Schreibflaeche des Editors, deren DOM aus Tiptap kommt und keine
 * Utility-Klassen kennt.
 *
 * <p><strong>Achtzehn Token und nicht siebenundzwanzig:</strong> die Schrift
 * auf einer Hervorhebung bleibt {@code --foreground}. Trifft eine Textfarbe
 * auf eine Hervorhebung, ist der Kontrast nicht zugesichert; die
 * Auswahlleiste setzt je Auswahl entweder Farbe oder Hervorhebung und
 * entfernt die andere Mark.
 *
 * <p><strong>Vier Rollen sind mit Contract v63 dazugekommen</strong>
 * ({@code brown}, {@code orange}, {@code purple}, {@code pink}). Eine
 * erweiterte Palette laesst nur mehr zu und entwertet nichts: gespeicherte
 * Dokumente sind nicht betroffen, und es braucht dafuer keine
 * Schemamigration. Die vier neuen Rampen stehen in
 * {@code styles/tokens/tokens.css}, ihre gemessenen Kontraste im Kommentar
 * dort.
 */

/**
 * Die neun Rollennamen aus Contract 2.5, abschliessend.
 *
 * <p><strong>Die Reihenfolge ist die des Farbwaehlers</strong> (Figma
 * {@code ColorMenu}, Raster fuenf mal zwei je Gruppe): sie laeuft von warm
 * nach kalt und nicht alphabetisch. Der zehnte Platz jeder Gruppe ist
 * „Standard", also das Fehlen des Marks; er steht bewusst nicht in dieser
 * Liste, weil es dafuer nichts zu setzen und kein Token zu fuehren gibt.
 */
export const CONTENT_COLOR_ROLES = [
  "neutral",
  "brown",
  "orange",
  "amber",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const

export type ContentColorRole = (typeof CONTENT_COLOR_ROLES)[number]

/**
 * Token je Rolle, hell und dunkel aufgeloest in
 * {@code styles/tokens/tokens.css}. Als {@code Record} ueber den Rollentyp
 * gefuehrt: eine zehnte Rolle im Contract bricht damit den Typecheck,
 * statt still auf einen Standardwert zu fallen (Skill frontend-shadcn,
 * Abschnitt 6).
 */
export const CONTENT_COLOR_TOKENS: Record<
  ContentColorRole,
  { readonly text: string; readonly highlight: string }
> = {
  neutral: {
    text: "--content-text-neutral",
    highlight: "--content-highlight-neutral",
  },
  brown: {
    text: "--content-text-brown",
    highlight: "--content-highlight-brown",
  },
  orange: {
    text: "--content-text-orange",
    highlight: "--content-highlight-orange",
  },
  amber: {
    text: "--content-text-amber",
    highlight: "--content-highlight-amber",
  },
  green: {
    text: "--content-text-green",
    highlight: "--content-highlight-green",
  },
  blue: { text: "--content-text-blue", highlight: "--content-highlight-blue" },
  purple: {
    text: "--content-text-purple",
    highlight: "--content-highlight-purple",
  },
  pink: { text: "--content-text-pink", highlight: "--content-highlight-pink" },
  red: { text: "--content-text-red", highlight: "--content-highlight-red" },
}

/**
 * Typwaechter an der Lesegrenze. Ein unbekannter Rollenname wird beim Lesen
 * verworfen und nicht uebernommen (Contract 2.5); ein Hex-Wert und ein
 * CSS-Ausdruck sind genau das, was hier scheitern muss.
 */
export function isContentColorRole(value: unknown): value is ContentColorRole {
  return (
    typeof value === "string" &&
    (CONTENT_COLOR_ROLES as readonly string[]).includes(value)
  )
}
