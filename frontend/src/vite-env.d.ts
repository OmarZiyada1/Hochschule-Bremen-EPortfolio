/// <reference types="vite/client" />

/*
 * Typisierung der eigenen Umgebungsvariablen, damit ein Tippfehler im
 * Namen beim Typecheck auffaellt und nicht erst als undefined zur Laufzeit.
 */
interface ImportMetaEnv {
  /**
   * Basis-URL der API fuer Betriebsarten mit getrenntem API-Ursprung.
   * Ungesetzt laufen Requests gegen den eigenen Ursprung; im
   * Entwicklungsbetrieb proxyt der Vite-Server /api auf das Backend
   * (vite.config.ts).
   */
  readonly VITE_API_BASE_URL?: string

  /*
   * Die Angaben des Impressums (KAN-100). Sie stehen bewusst NICHT in
   * de.json und en.json, obwohl sie sichtbarer Oberflaechentext sind:
   * dieses Repository liegt oeffentlich auf GitHub, und eine
   * ladungsfaehige Privatanschrift waere dort dauerhaft in der Historie,
   * auch nachdem sie jemand wieder herausnimmt. Die Sprachdateien tragen
   * deshalb nur die Beschriftungen, die Werte kommen zur BAUZEIT aus der
   * nicht eingecheckten .env (frontend/Dockerfile reicht sie als
   * build args durch).
   *
   * Alle vier sind optional, und das ist kein Versehen: ein fehlender
   * Wert darf den Bau nicht abbrechen, sonst laeuft "pnpm build" auf
   * keinem Entwicklerrechner mehr durch. Fehlt einer, sagt die Seite das
   * sichtbar (imprint.operator.missing), statt eine erfundene Anschrift
   * zu zeigen; Frontend-Regel 10 verbietet die Attrappe, und hier waere
   * sie zugleich eine falsche Rechtsauskunft.
   */

  /** Betreiber, wie er im Impressum steht; ein Name oder zwei. */
  readonly VITE_IMPRINT_OPERATOR?: string
  /** Strasse und Hausnummer der ladungsfaehigen Anschrift. */
  readonly VITE_IMPRINT_STREET?: string
  /** Postleitzahl und Ort der ladungsfaehigen Anschrift. */
  readonly VITE_IMPRINT_CITY?: string
  /** Kontaktpostfach fuer Impressum und Betroffenenrechte. */
  readonly VITE_IMPRINT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
