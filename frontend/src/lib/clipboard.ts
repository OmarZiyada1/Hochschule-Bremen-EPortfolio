/**
 * Text in die Zwischenablage legen (KAN-39).
 *
 * <p><strong>Warum es diese Huelle gibt.</strong> Die Kontoanlage gibt ein
 * Initialpasswort aus, das die Administration weitergeben muss, und die
 * Zuruecksetzung ebenso (§6.7). Ohne Kopierfunktion wird es abgetippt, und
 * genau dabei entstehen die Fehler, die eine erste Anmeldung scheitern
 * lassen. Der Aufruf steht hier und nicht je Dialog, damit beide Stellen
 * dieselbe Rueckmeldung geben.
 *
 * <p><strong>Sie kann fehlschlagen, und das ist kein Sonderfall.</strong>
 * {@code navigator.clipboard} gibt es nur in sicheren Kontexten, und der
 * Browser kann die Freigabe verweigern. Die Funktion wirft deshalb nicht,
 * sondern meldet den Misserfolg; die aufrufende Stelle zeigt dann den Wert
 * zum Abschreiben, statt so zu tun, als sei kopiert worden.
 *
 * @returns ob der Text tatsaechlich in der Zwischenablage liegt
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || navigator.clipboard === undefined) {
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
