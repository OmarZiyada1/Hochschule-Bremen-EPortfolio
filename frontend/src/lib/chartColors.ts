/**
 * Farbvergabe fuer Diagramme (KAN-80).
 *
 * <p><strong>Warum eine eigene Palette und nicht die Badge-Toene.</strong> Die
 * ersten Diagramme des Dashboards nahmen die Vordergrundtoene der Badges
 * ({@code role-*-fg}, {@code pill-*-fg}). Die sind fuer Text auf einer
 * blassen Pille gebaut, also dunkel und satt; als grosse Kreissegmente sassen
 * sie schwer auf der Karte, und drei davon nebeneinander waren kaum noch
 * auseinanderzuhalten.
 *
 * <p><strong>Vier Familien, zu diesem Ticket vorgegeben</strong>: Himmel,
 * Minze, Gelb und Orange, kein Grau und kein Schwarz. Die Kennzahlen des
 * Dashboards trugen bis dahin die Toene der Status-Badges, darunter ein
 * Grau, ein Braun und ein dunkles Rot; sie lasen sich als Warnung, obwohl
 * sie nur zaehlen. Jede Familie fuehrt eine Fuellstufe fuer Flaechen und
 * eine dunkle fuer Schrift ({@code tokens.css}).
 *
 * <p><strong>Vergeben wird nach Position.</strong> Eine Reihe ohne eigene
 * Bedeutung nimmt {@link chartColor} mit ihrem Index; kommt eine Kategorie
 * dazu, bekommt sie ohne Codeaenderung die naechste Farbe. Genau darum geht
 * es bei Stammdaten: eine sechste Fakultaet soll nicht farblos bleiben und
 * auch keinen Eintrag in einer Zuordnungstabelle brauchen.
 *
 * <p><strong>Wo eine Bedeutung da ist, bleibt sie.</strong> Der Kontostatus
 * laeuft von Minze ueber Gelb nach Orange, weil „aktiv", „Registrierung
 * offen" und „deaktiviert" genau diese Reihenfolge haben; genommen wird der
 * Ton aber aus derselben Palette. Die Zuordnung steht als {@code Record}
 * ueber dem Enum an der Komponente, wie bei {@code UserStatusBadge}: ein
 * vierter Wert bricht dann den Typecheck, statt still farblos zu bleiben.
 *
 * <p>Farbe ist nie die Aussage: Legende und die {@code sr-only}-Tabelle
 * neben jedem Diagramm nennen jede Reihe im Klartext (SC 1.4.1).
 *
 * <p><strong>Genannt wird die Rolle selbst und nicht ihre
 * Tailwind-Bindung.</strong> Der Name entsteht hier zur Laufzeit aus dem
 * Index; ein {@code --color-chart-*} im Block {@code @theme inline} saehe
 * fuer Tailwind deshalb unbenutzt aus und fiele beim Buendeln heraus, und die
 * Segmente waeren im gebauten Stand farblos. Weder Typecheck noch Linter noch
 * ein Test haetten das gemeldet; aufgefallen ist es erst im gebauten CSS
 * (derselbe Fehlermodus wie bei {@code --radius} in {@code input-group.tsx},
 * Review zu KAN-29). {@code tokens.css} fuehrt die Palette deshalb als
 * gewoehnliche Deklaration unter {@code :root}, und der Test unten prueft,
 * dass jeder hier genannte Name dort auch steht.
 */

/** So viele unterscheidbare Toene fuehrt die Palette (tokens.css). */
export const CHART_COLOR_COUNT = 4

/**
 * Die Farbe der {@code index}-ten Reihe, nullbasiert.
 *
 * <p>Nach dem letzten Eintrag beginnt die Palette von vorn. Das ist kein
 * Versehen, sondern die Reissleine: zwei gleiche Farben sind das kleinere
 * Uebel gegenueber einer Reihe ganz ohne, und benannt ist jede Reihe
 * ohnehin in der Legende. Die Kennzahlenreihe des Dashboards macht davon
 * Gebrauch: sechs Kacheln laufen durch vier Familien.
 */
export function chartColor(index: number): string {
  const step =
    ((index % CHART_COLOR_COUNT) + CHART_COLOR_COUNT) % CHART_COLOR_COUNT
  return `var(--chart-${step + 1})`
}

/**
 * Die Schriftfassung derselben Reihe, eine Stufe dunkler.
 *
 * <p>Fuer Zahlen und Beschriftungen, die als Text auf der Karte stehen und
 * deshalb Kontrast brauchen ({@link chartColor} liefert eine Fuellfarbe und
 * keine Schriftfarbe): auf Weiss liegen die Fuellstufen bei 1,6 bis 2,5:1
 * und waeren unlesbar, die dunklen bei 4,6 bis 5,4:1. Im dunklen Modus
 * tauschen beide die Rolle, dort traegt die Fuellstufe die Schrift.
 */
export function chartTextColor(index: number): string {
  const step =
    ((index % CHART_COLOR_COUNT) + CHART_COLOR_COUNT) % CHART_COLOR_COUNT
  return `var(--chart-text-${step + 1})`
}

/**
 * Der ruhige Ton fuer den Rest eines Stapels, also fuer das, was gerade
 * <em>nicht</em> die Aussage des Diagramms ist: im hellen Modus der blasse
 * Himmelston, im dunklen der tiefe. Er folgt als einzige Rolle der Palette
 * dem Grund, damit er in beiden Faellen zuruecktritt statt zu leuchten.
 */
export const CHART_MUTED_COLOR = "var(--chart-muted)"
