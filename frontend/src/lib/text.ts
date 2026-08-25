/**
 * Laenge, ab der ein Projekttitel in Tabellen und im Brotkrumenpfad gekuerzt
 * wird (KAN-80).
 *
 * <p>Zwanzig Zeichen, weil die Tabellen der Administration und von „Meine
 * Reviews" sieben Spalten fuehren: ein ausgeschriebener Titel wie
 * „Nachhaltige Mobilitaetskonzepte fuer die Innenstadt" schob dort die
 * uebrigen Spalten aus dem Fenster, und die Seite bekam einen waagerechten
 * Bildlauf. Im Brotkrumenpfad ist es dasselbe Problem in einer Zeile.
 */
export const TITLE_TRUNCATE_LENGTH = 20

/**
 * Kuerzt einen Text auf {@code max} Zeichen und haengt ein Auslassungszeichen
 * an; kuerzere Texte bleiben unveraendert.
 *
 * <p><strong>Warum hart gekuerzt und nicht per CSS.</strong> Ein
 * {@code text-overflow: ellipsis} braucht eine Breite, an der es abschneiden
 * kann. In einer Tabellenzelle gibt es die nicht: die Spalte ist so breit, wie
 * ihr laengster Inhalt sie macht, und genau das soll hier verhindert werden.
 * Ein festes Spaltenmass daneben waere eine zweite Stelle, die zur Zeichenzahl
 * passen muesste.
 *
 * <p><strong>Das Auslassungszeichen ersetzt nicht.</strong> Zwanzig Zeichen
 * plus „…" ergeben einundzwanzig; die Grenze ist die Zahl der Zeichen des
 * Titels, nicht die der Ausgabe. So steht an jeder gekuerzten Stelle gleich
 * viel Text.
 *
 * <p><strong>Der volle Text geht nicht verloren.</strong> Wer kuerzt, zeigt
 * ihn daneben fuer Hilfsmittel ({@code sr-only}) und im {@code title}; die
 * Regel dafuer steht an den Verwendern, nicht hier, damit diese Funktion rein
 * bleibt und ohne Rendern pruefbar ist.
 */
export function truncate(value: string, max = TITLE_TRUNCATE_LENGTH): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) {
    return trimmed
  }
  /* Ohne trimEnd stuende bei „Ein langer Titel " ein Leerzeichen vor dem
     Auslassungszeichen. */
  return `${trimmed.slice(0, max).trimEnd()}…`
}

/** Ist dieser Text laenger als die Grenze, wird also gekuerzt? */
export function isTruncated(value: string, max = TITLE_TRUNCATE_LENGTH) {
  return value.trim().length > max
}
