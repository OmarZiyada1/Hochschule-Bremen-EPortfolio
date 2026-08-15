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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
