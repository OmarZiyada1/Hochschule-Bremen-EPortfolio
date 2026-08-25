import { z } from "zod"

/**
 * Das Formular des Annahme-Dialogs (§3.11.1, §6.1; KAN-40): der Platz, den
 * die Administration vergibt.
 *
 * <p><strong>Der Platz ist Pflicht, die Stufe ist er nicht.</strong> Seit
 * Contract v68 schlaegt die Redaktion eine Stufe vor (§2.13) und keinen
 * Platz; ueber den Platz entscheidet allein dieser Dialog. Der Server prueft
 * <em>nicht</em>, ob der gewaehlte Platz in den Bereich der Stufe faellt,
 * und das Schema tut es deshalb auch nicht: eine Bindung zwaenge die
 * Administration, einen als TOP_1 vorgeschlagenen Beitrag erst abzulehnen,
 * um ihn auf Platz 4 setzen zu koennen.
 *
 * <p><strong>Geprueft wird die Eingabe, nicht die Antwort</strong>
 * (Frontend-Regel 12). Verbindlich bleibt der Server: er beantwortet einen
 * fehlenden oder unzulaessigen Platz mit 400 {@code VALIDATION_FAILED} und
 * einen bereits belegten mit 409 {@code RESOURCE_IN_USE}. Dieses Schema
 * macht den ersten Fall nur vor dem Absenden sichtbar.
 *
 * <p><strong>Warum trotzdem der ganze Bereich geprueft wird.</strong> Die
 * Auswahl bietet nur freie Plaetze an, kann also von sich aus keinen Wert
 * ausserhalb von 1 bis 10 erzeugen. Die Grenze steht hier als Zusage des
 * Endpoints und nicht als Absicherung des Bedienelements: sie gilt auch
 * dann noch, wenn das Feld eines Tages ein Eingabefeld ist.
 */

/** Erster und letzter vergebbarer Platz (§3.11). */
export const TOP10_MIN_POSITION = 1
export const TOP10_MAX_POSITION = 10

/**
 * Der Formularwert ist eine Zeichenkette, weil das Auswahlfeld eine liefert;
 * eine leere steht fuer „noch nichts gewaehlt". Umgewandelt wird erst beim
 * Absenden, damit die beiden Fehlerfaelle unterscheidbar bleiben: „nichts
 * gewaehlt" und „ausserhalb des Bereichs" verlangen verschiedene Texte.
 */
export const acceptNominationSchema = z.object({
  position: z
    .string()
    .refine((value) => value.trim() !== "", {
      message: "validation.top10.positionRequired",
    })
    .refine(
      (value) => {
        const parsed = Number(value)
        return (
          Number.isInteger(parsed) &&
          parsed >= TOP10_MIN_POSITION &&
          parsed <= TOP10_MAX_POSITION
        )
      },
      { message: "validation.top10.positionOutOfRange" }
    ),
})

export type AcceptNominationFormValues = z.infer<typeof acceptNominationSchema>
