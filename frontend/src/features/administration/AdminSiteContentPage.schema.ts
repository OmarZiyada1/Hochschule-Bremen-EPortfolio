import { z } from "zod"

/**
 * Die pflegbaren Stellen der Startseite und ihre Eingabepruefung an genau
 * einer Stelle (Contract §2.16, §3.21, Frontend-Regel 12).
 *
 * <p><strong>Warum Liste und Regel in derselben Datei stehen.</strong> Die
 * Regel haengt an der Liste: welcher Platzhalter Pflicht ist, entscheidet
 * der Schluessel und sonst nichts. Getrennt gefuehrt liefen beide beim
 * naechsten Nachtrag auseinander, und die Maske zeigte dann ein Feld, dessen
 * Pflicht sie nicht kennt, oder pruefte eine Pflicht an einem Feld, das es
 * nicht mehr gibt.
 *
 * <p><strong>Gespiegelt, nicht erfunden.</strong> Jede Regel hier hat ihr
 * Gegenstueck im Server ({@code SiteContentKey}, {@code SiteContentService}):
 * dieselben fuenfzehn Schluessel, dieselben Pflichtplatzhalter, dieselbe
 * Obergrenze von 1000 Zeichen. Verbindlich bleibt trotzdem der Server; diese
 * Pruefung erspart nur den Weg zum Server, sie ersetzt ihn nicht. Sein 400
 * {@code VALIDATION_FAILED} erscheint am betroffenen Feld (§6.2).
 *
 * <p><strong>zod prueft Eingaben, nie Serverantworten</strong>
 * (Frontend-Regel 12). Die Antworttypen kommen aus der generierten
 * {@code schema.d.ts}; dass der generierte {@code SiteContentEntryRequest}
 * seinen {@code key} als optional fuehrt, ist eine Eigenart von springdoc und
 * kein Freibrief: hier ist er Pflicht, weil er es im Server ist.
 */

/** {@code SiteContentEntryRequest.valueDe} und {@code .valueEn} (§6.1). */
export const SITE_CONTENT_VALUE_MAX = 1000

/** Eine pflegbare Textstelle der Startseite. */
export interface SiteContentFieldSpec {
  /**
   * Der i18n-Schluessel, unverändert wie im Contract und im Request.
   * Uebersetzt wird nur die Beschriftung daneben.
   */
  key: string
  /**
   * Der sprechende Name der Stelle: Schluessel unter
   * {@code administration.siteContent.field.*}.
   *
   * <p>Er steht hier und nicht als roher Schluessel in der Oberflaeche.
   * „home.cta.statFaculties" sagt niemandem, welche Stelle der Startseite
   * gemeint ist; „Beschriftung der Kennzahl Fakultäten" sagt es.
   */
  labelKey: string
  /**
   * Die Platzhalter, die der Text tragen muss, ohne Klammern
   * (z. B. {@code year}). Leer heisst: diese Stelle vertraegt keinen.
   */
  requiredPlaceholders: readonly string[]
  /** Mehrzeiliges Feld? Nur die drei laengeren Fliesstexte. */
  multiline?: true
}

/** Ein Abschnitt der Startseite mit seinen Stellen. */
export interface SiteContentSectionSpec {
  /** Kurzname, zugleich Teil der Element-IDs der Ueberschrift. */
  id: string
  /** Schluessel unter {@code administration.siteContent.section.*}. */
  titleKey: string
  fields: readonly SiteContentFieldSpec[]
}

/**
 * Die fuenfzehn Stellen, gegliedert wie die Startseite selbst.
 *
 * <p><strong>Die Reihenfolge ist die der Seite</strong>, von oben nach unten,
 * damit die Maske und die Seite sich Zeile fuer Zeile entsprechen. Sie ist
 * zugleich die Reihenfolge im Request: der Server nennt seine Feldfehler mit
 * Index ({@code entries[3].valueDe}), und nur bei gleicher Ordnung zeigt ein
 * solcher Fehler auf dasselbe Feld, das ihn ausgeloest hat.
 *
 * <p><strong>Drei Beschriftungen fehlen mit Absicht.</strong>
 * {@code home.top10.viewProject}, {@code home.top10.freeSlot} und
 * {@code home.top10.freeBadge} stehen zwar unter {@code home.*}, sind aber
 * Beschriftungen von Komponenten, die auch ausserhalb der Startseite
 * auftreten (Top-10-Verwaltung, Kachel eines freien Platzes). Sie dort zu
 * pflegen hiesse, von der Startseite aus einen Text der Administrationsseite
 * zu aendern. Der Server fuehrt sie aus demselben Grund nicht (§2.16).
 */
export const SITE_CONTENT_SECTIONS: readonly SiteContentSectionSpec[] = [
  {
    id: "hero",
    titleKey: "administration.siteContent.section.hero",
    fields: [
      {
        key: "home.hero.label",
        labelKey: "administration.siteContent.field.heroLabel",
        requiredPlaceholders: [],
      },
      {
        key: "home.hero.titleLine1",
        labelKey: "administration.siteContent.field.heroTitleLine1",
        requiredPlaceholders: [],
      },
      {
        key: "home.hero.titleLine2",
        labelKey: "administration.siteContent.field.heroTitleLine2",
        requiredPlaceholders: [],
      },
      {
        key: "home.hero.subtitle",
        labelKey: "administration.siteContent.field.heroSubtitle",
        requiredPlaceholders: [],
        multiline: true,
      },
      {
        key: "home.hero.exploreTop10",
        labelKey: "administration.siteContent.field.heroExploreTop10",
        requiredPlaceholders: [],
      },
    ],
  },
  {
    id: "top10",
    titleKey: "administration.siteContent.section.top10",
    fields: [
      {
        key: "home.top10.label",
        labelKey: "administration.siteContent.field.top10Label",
        requiredPlaceholders: [],
      },
      {
        /* Die Jahreszahl setzt die Seite, nicht die Redaktion: ohne den
           Platzhalter verschwindet sie wortlos aus der Ueberschrift. */
        key: "home.top10.title",
        labelKey: "administration.siteContent.field.top10Title",
        requiredPlaceholders: ["year"],
      },
      {
        key: "home.top10.description",
        labelKey: "administration.siteContent.field.top10Description",
        requiredPlaceholders: [],
        multiline: true,
      },
    ],
  },
  {
    id: "cta",
    titleKey: "administration.siteContent.section.cta",
    fields: [
      {
        key: "home.cta.label",
        labelKey: "administration.siteContent.field.ctaLabel",
        requiredPlaceholders: [],
      },
      {
        key: "home.cta.title",
        labelKey: "administration.siteContent.field.ctaTitle",
        requiredPlaceholders: [],
      },
      {
        /* Beide Zahlen kommen aus den Kennzahlen der Startseite. */
        key: "home.cta.description",
        labelKey: "administration.siteContent.field.ctaDescription",
        requiredPlaceholders: ["works", "faculties"],
        multiline: true,
      },
      {
        key: "home.cta.statWorks",
        labelKey: "administration.siteContent.field.ctaStatWorks",
        requiredPlaceholders: [],
      },
      {
        key: "home.cta.statFaculties",
        labelKey: "administration.siteContent.field.ctaStatFaculties",
        requiredPlaceholders: [],
      },
      {
        key: "home.cta.statPrograms",
        labelKey: "administration.siteContent.field.ctaStatPrograms",
        requiredPlaceholders: [],
      },
      {
        key: "home.cta.openLibrary",
        labelKey: "administration.siteContent.field.ctaOpenLibrary",
        requiredPlaceholders: [],
      },
    ],
  },
]

/** Dieselben Stellen flach, in der Reihenfolge des Requests. */
export const SITE_CONTENT_FIELDS: readonly SiteContentFieldSpec[] =
  SITE_CONTENT_SECTIONS.flatMap((section) => section.fields)

/**
 * Die Platzhalter eines Textes, ohne Klammern und in der Reihenfolge ihres
 * Auftretens.
 *
 * <p>Dasselbe Muster wie im Server ({@code SiteContentService.PLACEHOLDER}),
 * einschliesslich des genuegsamen Quantors: {@code {{a}} und {{b}}} sind zwei
 * Platzhalter und nicht einer. {@code [\s\S]} steht fuer den dortigen
 * {@code DOTALL}-Schalter, denn ein Zeilenumbruch mitten in einer Klammer
 * waere auch dort ein Treffer.
 */
function placeholdersIn(value: string): string[] {
  return [...value.matchAll(/\{\{([\s\S]*?)\}\}/g)].map((match) =>
    match[1].trim()
  )
}

/**
 * Der i18n-Schluessel der Meldung, wenn die Platzhalter eines Textes nicht
 * zu seiner Stelle passen, sonst {@code null}.
 *
 * <p><strong>Ein leerer Text wird nicht geprueft</strong>, wie im Server: er
 * loescht die Pflege, und was geloescht ist, wird nie angezeigt. Reiner
 * Leerraum zaehlt dabei als leer.
 *
 * <p><strong>Geprueft wird auf Gleichheit, nicht auf Vorhandensein.</strong>
 * Ein fehlender Platzhalter laesst die Zahl wortlos verschwinden, ein
 * ueberzaehliger steht woertlich auf der Seite; beides faellt beim Tippen
 * niemandem auf, und beides ist deshalb ein Fehler.
 */
export function placeholderIssueKey(
  field: SiteContentFieldSpec,
  value: string
): string | null {
  if (value.trim() === "") {
    return null
  }

  const found = new Set(placeholdersIn(value))
  const required = new Set(field.requiredPlaceholders)

  const missing = [...required].filter((name) => !found.has(name))
  if (missing.length > 0) {
    return "validation.siteContent.placeholderMissing"
  }

  const unexpected = [...found].filter((name) => !required.has(name))
  if (unexpected.length > 0) {
    return "validation.siteContent.placeholderUnexpected"
  }

  return null
}

/**
 * Die Eingabepruefung der Pflegemaske.
 *
 * <p>Alle fuenfzehn Stellen stehen als Feld im Formular, auch die
 * ungepflegten: der Request ersetzt je Schluessel, und ein weggelassenes
 * Feld hiesse dort nicht „bleibt wie es war" (§6.1). Ein leerer Wert ist
 * deshalb ein gueltiger Wert und keine fehlende Angabe.
 */
export const siteContentFormSchema = z
  .object({
    entries: z.array(
      z.object({
        /* Ohne eigene Regel: der Schluessel kommt aus SITE_CONTENT_FIELDS
           und wird nie eingegeben. Eine Mindestlaenge daneben braeuchte
           einen Meldungstext, den niemand je zu sehen bekaeme. */
        key: z.string(),
        valueDe: z
          .string()
          .max(SITE_CONTENT_VALUE_MAX, "validation.siteContent.tooLong"),
        valueEn: z
          .string()
          .max(SITE_CONTENT_VALUE_MAX, "validation.siteContent.tooLong"),
      })
    ),
  })
  .superRefine((values, context) => {
    values.entries.forEach((entry, index) => {
      const field = SITE_CONTENT_FIELDS.find(
        (candidate) => candidate.key === entry.key
      )
      /* Ein Schluessel ausserhalb der Liste kann aus diesem Formular nicht
         entstehen; sollte er es doch, lehnt ihn der Server ab (§2.16). */
      if (field === undefined) {
        return
      }
      for (const language of ["valueDe", "valueEn"] as const) {
        const message = placeholderIssueKey(field, entry[language])
        if (message !== null) {
          context.addIssue({
            code: "custom",
            path: ["entries", index, language],
            message,
          })
        }
      }
    })
  })

export type SiteContentFormValues = z.infer<typeof siteContentFormSchema>

/**
 * Die Feldnamen, die der Server in einem 400 {@code VALIDATION_FAILED}
 * nennen kann (§6.2, Format {@code feld: Text}).
 *
 * <p>Er schreibt sie wie die Bean-Validation mit Index in eckigen Klammern,
 * {@code entries[3].valueDe}. Ohne diese Liste deutete
 * {@code applyValidationErrors} jeden Doppelpunkt im Meldungstext als
 * Feldnamen; mit ihr, aber ohne {@link formPathOfServerField}, landete jeder
 * Feldfehler ueber den Rueckfall auf das Wurzelsegment am ganzen Formular
 * statt an seiner Zeile.
 *
 * <p><strong>{@code entries[i].key} steht mit Absicht nicht darin.</strong>
 * Der Server kann diesen Namen nennen (unbekannter oder doppelter
 * Schluessel), die Maske rendert dafuer aber kein Feld: die Schluessel sind
 * fest und stehen nirgends in der Oberflaeche. Aufgenommen landete eine
 * solche Meldung an einem Feld, das es nicht gibt, und verschwaende spurlos.
 * Nicht aufgenommen faellt sie ueber den Rueckfall auf {@code root.server}
 * und wird ueber dem Formular sichtbar. Aus dieser Maske ist der Fall
 * unerreichbar; still verschlucken darf ihn der Weg dorthin trotzdem nicht
 * (Befund des frontend-reviewers).
 */
export const SITE_CONTENT_SERVER_FIELDS: readonly string[] =
  SITE_CONTENT_FIELDS.flatMap((_, index) => [
    `entries[${index}].valueDe`,
    `entries[${index}].valueEn`,
  ])

/**
 * Schreibweise des Servers in den Pfad von react-hook-form:
 * {@code entries[3].valueDe} wird zu {@code entries.3.valueDe}.
 *
 * <p>Alles ohne Klammern laeuft unveraendert durch, insbesondere
 * {@code root.server} fuer das, was sich keinem Feld zuordnen laesst.
 */
export function formPathOfServerField(field: string): string {
  return field.replace(/\[(\d+)\]/g, ".$1")
}
