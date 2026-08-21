import { z } from "zod"

import {
  ALLOWED_EMBED_HOSTS,
  EMBED_PROVIDERS,
  VIDEO_ID_PATTERNS,
  VIDEO_PROVIDERS,
  type EmbedProvider,
  type VideoProvider,
} from "@/features/project-content/providers"

/**
 * Eingabepruefung der sieben Blockdialoge (Frontend-Regel 12).
 *
 * <p><strong>Warum es die Dialoge ueberhaupt gibt.</strong> Ein Medienknoten
 * entsteht erst, wenn alle Pflichtattribute aus Contract 2.5 beisammen sind.
 * {@code BlockService.replace} prueft die <em>gesamte</em> Blockliste, bevor
 * es die erste Zeile schreibt: ein leerer Bildknoten ohne {@code fileId}
 * machte damit jeden weiteren Autosave des ganzen Projekts unmoeglich, und
 * zwar so lange, bis jemand ihn wieder loescht. Deshalb wird gefragt, bevor
 * eingefuegt wird, und nicht danach.
 *
 * <p><strong>Was hier geprueft wird und was nicht.</strong> zod prueft
 * Eingaben, nie Serverantworten (Frontend-Regel 2 und 12). Verbindlich
 * bleibt der Server: die Provider- und Host-Allowlist steht hier als
 * Vorabhinweis, damit niemand erst nach dem Speichern erfaehrt, dass die
 * Adresse nicht durchgeht; ein Verstoss ergibt serverseitig 400
 * {@code EMBED_PROVIDER_NOT_ALLOWED} (6.2). Die Listen selbst kommen aus
 * {@code providers.ts} und werden hier nicht ein zweites Mal
 * aufgeschrieben.
 */

/* ------------------------------------------------------------------ */
/* Gemeinsame Bausteine                                                 */
/* ------------------------------------------------------------------ */

/**
 * Die Datei-ID, die ein Upload zurueckgibt. Im Formular steht sie als
 * leerer Text, bis hochgeladen wurde; die Meldung nennt deshalb die
 * fehlende Datei und nicht ein ungueltiges Format.
 */
const fileId = z.string().min(1, "validation.blockFile.required")

/** Unterschrift und Alternativtext sind Freitext und duerfen leer sein. */
const caption = z.string()

/**
 * Alternativtext mit ausdruecklicher Ausnahme.
 *
 * <p>Contract 2.5 unterscheidet zwei Faelle, und der Server tut es auch:
 * ein leeres {@code alt} ist die Aussage „dieses Bild ist schmueckend", ein
 * fehlendes ein vergessener Alternativtext, und den weist er ab. Im
 * Formular heisst das: entweder steht ein Text da, oder das Haekchen
 * „schmueckend" ist gesetzt. Beides leer ist keine dritte Moeglichkeit
 * (SC 1.1.1).
 */
const ALT_FIELDS = { alt: z.string(), decorative: z.boolean() }

/**
 * Die Bedingung selbst, als Funktion. Sie sitzt an drei Stellen (Bild,
 * Galerieeintrag, und kuenftig jeder weitere Bildkontext) und steht deshalb
 * nur einmal da; als vorgefertigtes Schema laesse sie sich nicht in eine
 * groessere Objektform einsetzen, weil {@code refine} kein Objektschema mehr
 * zurueckgibt.
 */
function hasAltOrIsDecorative(value: {
  alt: string
  decorative: boolean
}): boolean {
  return value.decorative || value.alt.trim().length > 0
}

/* ------------------------------------------------------------------ */
/* IMAGE                                                                */
/* ------------------------------------------------------------------ */

/** Genau drei Stufen, in Prozent der Textspalte (2.5). */
export const IMAGE_WIDTH_VALUES = ["100", "75", "50"] as const

export const imageDialogSchema = z
  .object({
    fileId,
    ...ALT_FIELDS,
    caption,
    width: z.enum(IMAGE_WIDTH_VALUES),
  })
  .refine(hasAltOrIsDecorative, {
    path: ["alt"],
    message: "validation.blockAlt.required",
  })

export type ImageDialogValues = z.infer<typeof imageDialogSchema>

/* ------------------------------------------------------------------ */
/* GALLERY                                                              */
/* ------------------------------------------------------------------ */

/** Genau zwei Werte (2.5). */
export const GALLERY_COLUMN_VALUES = ["2", "3"] as const

export const galleryDialogSchema = z.object({
  items: z
    .array(
      z
        .object({ fileId, ...ALT_FIELDS })
        .refine(hasAltOrIsDecorative, {
          path: ["alt"],
          message: "validation.blockAlt.required",
        })
    )
    .min(1, "validation.blockGallery.empty"),
  columns: z.enum(GALLERY_COLUMN_VALUES),
  caption,
})

export type GalleryDialogValues = z.infer<typeof galleryDialogSchema>

/* ------------------------------------------------------------------ */
/* VIDEO                                                                */
/* ------------------------------------------------------------------ */

/**
 * Genau eine Quelle, nie beide und nie keine (2.5 seit v51). Im Formular
 * ist das eine Umschaltung und keine zwei unabhaengigen Felder: sonst waere
 * der ungueltige Zustand „beides ausgefuellt" ueberhaupt erreichbar.
 */
export const videoDialogSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("file"), fileId, caption }),
  z
    .object({
      source: z.literal("embed"),
      provider: z.enum(VIDEO_PROVIDERS),
      videoId: z.string().min(1, "validation.blockVideoId.required"),
      caption,
    })
    /*
     * Die Formpruefung der videoId haengt am gewaehlten Anbieter und braucht
     * damit beide Felder. Sie steht trotzdem im Schema und nicht im
     * Submit-Handler: eine handgeschriebene Pruefung daneben ist ein Befund
     * (Frontend-Regel 12), und nur im Schema greifen Modus und
     * Neubewertung des Formulars. Derselbe Bau wie bei EMBED, wo Provider
     * und Adresse ebenfalls zusammen geprueft werden.
     */
    .refine(
      (value) => isVideoIdValid(value.provider, value.videoId),
      { path: ["videoId"], message: "validation.blockVideoId.invalid" }
    ),
])

export type VideoDialogValues = z.infer<typeof videoDialogSchema>

/**
 * Prueft die {@code videoId} gegen das Muster ihres Anbieters, wortgleich
 * mit {@code BlockValidationService.VIDEO_ID_PATTERNS}. Verbindlich bleibt
 * der Server mit 400 {@code BLOCK_CONTENT_INVALID}.
 */
function isVideoIdValid(
  provider: VideoProvider,
  videoId: string
): boolean {
  return VIDEO_ID_PATTERNS[provider].test(videoId)
}

/* ------------------------------------------------------------------ */
/* AUDIO und DOCUMENT                                                   */
/* ------------------------------------------------------------------ */

export const audioDialogSchema = z.object({ fileId, caption })

export type AudioDialogValues = z.infer<typeof audioDialogSchema>

/**
 * DOCUMENT traegt neben der Datei-ID auch Namen und Groesse (2.5). Beide
 * kommen aus der Antwort des Uploads und werden nicht getippt: der Name im
 * Dokument ist der der hochgeladenen Datei, und eine getippte Groesse waere
 * eine Behauptung.
 */
export const documentDialogSchema = z.object({
  fileId,
  fileName: z.string().min(1, "validation.blockFile.required"),
  size: z.number().positive("validation.blockFile.required"),
})

export type DocumentDialogValues = z.infer<typeof documentDialogSchema>

/* ------------------------------------------------------------------ */
/* EMBED                                                                */
/* ------------------------------------------------------------------ */

/** Anzeigehoehe in CSS-Pixeln; der Renderer begrenzt sie auf 200 bis 1200. */
export const EMBED_HEIGHT_MIN = 200
export const EMBED_HEIGHT_MAX = 1200
export const EMBED_HEIGHT_DEFAULT = 460

export const embedDialogSchema = z
  .object({
    provider: z.enum(EMBED_PROVIDERS),
    embedUrl: z.string().min(1, "validation.blockEmbedUrl.required"),
    height: z
      .number()
      .int()
      .min(EMBED_HEIGHT_MIN, "validation.blockEmbedHeight.outOfRange")
      .max(EMBED_HEIGHT_MAX, "validation.blockEmbedHeight.outOfRange"),
  })
  .refine((value) => isAllowedEmbedInput(value.provider, value.embedUrl), {
    path: ["embedUrl"],
    message: "validation.blockEmbedUrl.notAllowed",
  })

export type EmbedDialogValues = z.infer<typeof embedDialogSchema>

/**
 * Host- und Schemapruefung der Einbettungsadresse, wortgleich mit
 * {@code isAllowedEmbedUrl} im Lesepfad und mit
 * {@code BlockValidationService} im Server. Eine unlesbare Adresse gilt als
 * nicht erlaubt.
 */
function isAllowedEmbedInput(
  provider: EmbedProvider,
  embedUrl: string
): boolean {
  let parsed: URL
  try {
    parsed = new URL(embedUrl.trim())
  } catch {
    return false
  }
  if (parsed.protocol.toLowerCase() !== "https:") {
    return false
  }
  return ALLOWED_EMBED_HOSTS[provider].includes(parsed.hostname.toLowerCase())
}

/* ------------------------------------------------------------------ */
/* FORMULA                                                              */
/* ------------------------------------------------------------------ */

/**
 * Auf Leerraum geprueft und nicht auf Laenge, wie serverseitig mit
 * {@code isBlank}: eine Formel aus drei Leerzeichen waere sonst hier
 * gueltig und beim Speichern ein 400.
 */
export const formulaDialogSchema = z.object({
  latex: z
    .string()
    .refine((value) => value.trim().length > 0, "validation.blockLatex.required"),
})

export type FormulaDialogValues = z.infer<typeof formulaDialogSchema>
