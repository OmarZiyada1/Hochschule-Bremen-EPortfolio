/**
 * Was sich je Medienblock hochladen laesst (Contract 3.15).
 *
 * <p><strong>Die Liste ist eine Vorwegnahme, keine zweite Wahrheit.</strong>
 * Verbindlich bleibt der Server mit 400 {@code FILE_TYPE_NOT_ALLOWED}
 * beziehungsweise {@code FILE_TOO_LARGE}; er prueft zusaetzlich die
 * Dateisignatur und nicht nur den gemeldeten Typ. Sie steht hier, weil ein
 * Video von 300 MB sonst erst nach dem vollstaendigen Hochladen abgelehnt
 * wuerde, und das ueber eine Mobilverbindung.
 *
 * <p>Die drei Grenzen stammen aus {@code AllowedFileType.MaxBytes}: Bilder
 * 10 MiB, Ton und Dokumente 25 MiB, Video 200 MiB.
 */

export type UploadKind = "image" | "audio" | "video" | "document"

export type UploadConstraint = {
  /** Fuer das accept-Attribut und die Vorpruefung. */
  readonly mimeTypes: readonly string[]
  readonly maxBytes: number
}

const MEBIBYTE = 1024 * 1024

export const UPLOAD_CONSTRAINTS: Record<UploadKind, UploadConstraint> = {
  image: {
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 10 * MEBIBYTE,
  },
  audio: {
    mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg"],
    maxBytes: 25 * MEBIBYTE,
  },
  video: {
    mimeTypes: ["video/mp4", "video/webm"],
    maxBytes: 200 * MEBIBYTE,
  },
  document: {
    mimeTypes: ["application/pdf"],
    maxBytes: 25 * MEBIBYTE,
  },
}

/** Die Grenze in Mebibyte, fuer die Meldung am Feld. */
export function maxMebibytes(kind: UploadKind): number {
  return Math.round(UPLOAD_CONSTRAINTS[kind].maxBytes / MEBIBYTE)
}

/**
 * Dateigroesse in der Schreibweise der Oberflaeche.
 *
 * <p>Bewusst mit {@code Intl} und nicht mit einer eigenen Rundung: die
 * Trennzeichen unterscheiden sich zwischen Deutsch und Englisch, und die
 * Zahl steht in einem Satz, den ein Screenreader vorliest.
 */
export function formatFileSize(bytes: number, locale: string): string {
  if (bytes < 1024) {
    return new Intl.NumberFormat(locale).format(bytes) + " B"
  }
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value = value / 1024
    unit = unit + 1
  }
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value)} ${units[unit]}`
}
