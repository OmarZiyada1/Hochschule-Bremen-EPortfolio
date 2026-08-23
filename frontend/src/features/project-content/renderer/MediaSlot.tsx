import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

/**
 * Wie es um die Datei hinter einem Medienblock steht.
 *
 * <p>Der Renderer selbst laedt nichts; den Zustand reicht die verwendende
 * Seite herein ({@code RenderContext.fileState}). Ohne sie gilt alles als
 * {@code ready}, und das ist fuer die oeffentliche Seite richtig: dort
 * steht die blosse Adresse im {@code src}, und ob der Abruf gelingt,
 * entscheidet erst der Browser.
 */
export type FileState = "ready" | "pending" | "error"

/**
 * Der Platz eines Mediums, samt Ladehinweis und Fehlermeldung.
 *
 * <p><strong>Warum es das braucht.</strong> Bis hierher endete jeder
 * fehlgeschlagene Abruf in einem stummen Rahmen: eine geloeschte Datei auf
 * der oeffentlichen Seite, eine Datei ohne Leserecht in der Ansicht der
 * Redaktion, ein abgebrochener Abruf in der Vorschau eines Entwurfs. Zu
 * sehen war davon nichts, weder Fehler noch Meldung, und wer den Beitrag
 * vorlesen laesst, erfuhr an dieser Stelle gar nichts. Die Schreibflaeche
 * sagt es seit KAN-36; die Leseansicht ist die haeufigere und die einzige
 * ohne Anmeldung, und sie schwieg.
 *
 * <p><strong>Zwei Wege fuehren zum Fehler, und beide werden gebraucht.</strong>
 * {@code state} kommt von der Seite und deckt den angemeldeten Abruf ab
 * (403 ohne Leserecht, 404 nach dem Loeschen, Abbruch). Das
 * {@code onError} des Elements deckt den oeffentlichen Weg ab, wo niemand
 * vorher abruft und erst der Browser merkt, dass unter der Adresse nichts
 * liegt. Deshalb bekommt das Kind eine Meldefunktion gereicht, statt dass
 * dieser Rahmen das Element selbst baut: ein {@code img} braucht andere
 * Attribute als ein {@code video}, und die kennt nur die aufrufende
 * Stelle.
 *
 * <p><strong>Der Ladehinweis ist keine Live-Region.</strong> Er traegt
 * {@code aria-busy} und sonst nichts: die Stelle wird beim Lesen erreicht,
 * eine Ansage mitten im Beitrag unterbraeche nur. Aus demselben Grund ist
 * die Fehlermeldung ein {@code role="note"} und kein {@code alert}, wie
 * schon bei {@code UnknownBlockNotice}.
 *
 * <p><strong>Zuruecksetzen ueber den Schluessel.</strong> Ist ein Element
 * einmal gescheitert, bleibt es das, bis eine andere Adresse kommt. Die
 * aufrufende Stelle gibt deshalb die Adresse als {@code key} mit; ohne das
 * bliebe die Meldung stehen, wenn ein Entwurf veroeffentlicht wird und
 * dieselbe Datei danach oeffentlich abrufbar ist.
 */
export function MediaSlot({
  state,
  children,
}: {
  state: FileState
  /**
   * Das eigentliche Element. {@code fail} gehoert an dessen
   * {@code onError}.
   */
  children: (fail: () => void) => ReactNode
}) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  if (state === "pending") {
    return (
      <p aria-busy="true" data-media-state="pending" className="type-body-sm">
        {t("projectContent.media.loading")}
      </p>
    )
  }

  if (state === "error" || failed) {
    return (
      <p role="note" data-media-state="error" className="type-body-sm">
        {t("projectContent.media.unavailable")}
      </p>
    )
  }

  return <>{children(() => setFailed(true))}</>
}
