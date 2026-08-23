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

/*
 * Eine zweite formatFileSize stand hier bis zum WYSIWYG-Umbau (binaer,
 * 1024er-Teilung) und lieferte am Dokumentblock eine andere Groesse als
 * der Renderer (dezimal, Intl-Einheiten): Editor "1,4 MB", Seite
 * "1,5 MB". Es gibt nur noch die Fassung in renderer/renderBlockNode.
 */
