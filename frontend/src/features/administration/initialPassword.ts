/**
 * Erzeugung des Initialpassworts fuer die Kontoanlage (§3.1.1, §6.7,
 * Contract v27).
 *
 * <p><strong>Der Client erzeugt, der Server nimmt nur entgegen.</strong>
 * {@code POST /api/admin/users} fuehrt das Passwort als Feld des Bodys und
 * gibt es nicht zurueck; die Administration muss es weitergeben und braucht
 * es deshalb im Formular. Anders bei
 * {@code POST /api/admin/users/{id}/reset-password}: dort gibt es kein
 * Formular, in das etwas einzutragen waere, also erzeugt der Server und
 * nennt das Ergebnis in der Antwort (KAN-43).
 *
 * <p><strong>Warum es diese Funktion ueberhaupt gibt.</strong> Ohne sie tippt
 * die Administration ein Passwort ab, das sie ohnehin weitergibt, und genau
 * dort entstehen die kurzen, wiederverwendeten Passwoerter, gegen die §6.7
 * den erzwungenen Wechsel setzt. Sie steht als reine Funktion neben der
 * Seite, damit ihre Zusagen ohne Rendern pruefbar sind (Skill
 * frontend-modul, Abschnitt 3).
 */

/*
 * Ohne die Zeichen, die sich in einer vorgelesenen oder abgeschriebenen
 * Zeichenkette verwechseln lassen: I, l, 1, O, 0. Das Passwort wird
 * muendlich oder auf Papier weitergegeben, und ein verwechseltes Zeichen
 * kostet genau den Weg, den die Kopierfunktion sparen soll.
 */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/**
 * Laenge des erzeugten Passworts. Deutlich ueber der Untergrenze von 12 aus
 * §3.1.1 und weit unter der Obergrenze von 72: die Person aendert es beim
 * ersten Login ohnehin (§6.7), bis dahin zaehlt allein, dass es nicht zu
 * raten ist.
 */
export const GENERATED_PASSWORD_LENGTH = 16

/**
 * Ein zufaelliges Initialpasswort.
 *
 * <p><strong>Aus {@code crypto.getRandomValues}, nicht aus
 * {@code Math.random}.</strong> Letzteres ist kein Zufallsgenerator fuer
 * Geheimnisse; sein Zustand laesst sich aus wenigen Ausgaben rekonstruieren.
 *
 * <p><strong>Mit Verwerfen statt mit Modulo.</strong> {@code byte % 56}
 * bevorzugte die ersten 32 Zeichen des Alphabets leicht, weil 256 kein
 * Vielfaches von 56 ist. Bytes oberhalb des groessten Vielfachen werden
 * deshalb weggeworfen und neu gezogen; das kostet im Mittel weniger als ein
 * zusaetzliches Byte je Zeichen.
 */
export function generateInitialPassword(
  length: number = GENERATED_PASSWORD_LENGTH
): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length
  const characters: string[] = []

  while (characters.length < length) {
    /* Blockweise ziehen: ein Aufruf je Zeichen waere derselbe Zufall in
       teuer. Der Zuschlag deckt die verworfenen Bytes ab. */
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte < limit && characters.length < length) {
        characters.push(ALPHABET[byte % ALPHABET.length])
      }
    }
  }

  return characters.join("")
}
