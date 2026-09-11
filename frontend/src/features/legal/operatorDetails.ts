/**
 * Die Angaben des Betreibers, wie sie Impressum und Datenschutzerklaerung
 * brauchen (KAN-100).
 *
 * <p><strong>Warum diese vier Werte nicht in de.json und en.json stehen</strong>,
 * wo aller uebrige Oberflaechentext steht (Frontend-Regel 7). Dieses
 * Repository liegt oeffentlich auf GitHub. Eine ladungsfaehige
 * Privatanschrift waere dort dauerhaft in der Historie, auch nachdem sie
 * jemand wieder herausnimmt: ein Commit loescht keinen Commit. Die
 * Sprachdateien tragen deshalb nur die Beschriftungen drumherum, die Werte
 * kommen zur BAUZEIT aus der nicht eingecheckten .env
 * (frontend/Dockerfile reicht sie als build args durch, compose.base.yml
 * setzt sie). Entschieden in der Klaerungsrunde zu KAN-100.
 *
 * <p><strong>Alles oder nichts.</strong> Fehlt auch nur einer der vier Werte,
 * gibt diese Funktion {@code null} zurueck und die Seite sagt sichtbar, dass
 * die Angaben fehlen. Der naheliegende Gegenentwurf waere, jedes vorhandene
 * Feld zu zeigen und die Luecke leer zu lassen; das ergaebe ein Impressum mit
 * Namen und ohne Anschrift, und ein halbes Impressum sieht aus wie ein
 * vollstaendiges. Ein ehrlicher Hinweis ist die bessere Auskunft als eine
 * Angabe, die etwas verschweigt.
 *
 * <p><strong>Gelesen wird beim Aufruf und nicht beim Laden des Moduls.</strong>
 * Anders als {@code BASE_URL} in api/client.ts, das als Konstante im
 * Modulkopf steht: dort aendert sich der Wert innerhalb eines Laufs nie, hier
 * dagegen tauschen die Tests ihn mit {@code vi.stubEnv} aus. Ein Wert, der
 * beim Import eingefroren waere, liesse sich nicht mehr pruefen, und gerade
 * der Fall „Angabe fehlt" gehoert geprueft.
 */
export type OperatorDetails = {
  /** Betreiber, wie er im Impressum steht; ein Name oder zwei. */
  readonly operator: string
  /** Strasse und Hausnummer. */
  readonly street: string
  /** Postleitzahl und Ort. */
  readonly city: string
  /** Postfach fuer Impressum und Betroffenenrechte. */
  readonly email: string
}

/**
 * Liest die vier Werte aus der Bauumgebung.
 *
 * @return die vollstaendigen Angaben, oder {@code null}, sobald einer der
 *         vier Werte fehlt oder nur aus Leerraum besteht
 */
export function readOperatorDetails(): OperatorDetails | null {
  const operator = import.meta.env.VITE_IMPRINT_OPERATOR?.trim() ?? ""
  const street = import.meta.env.VITE_IMPRINT_STREET?.trim() ?? ""
  const city = import.meta.env.VITE_IMPRINT_CITY?.trim() ?? ""
  const email = import.meta.env.VITE_IMPRINT_EMAIL?.trim() ?? ""

  if (!operator || !street || !city || !email) {
    return null
  }

  return { operator, street, city, email }
}
