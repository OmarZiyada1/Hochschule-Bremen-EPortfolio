import { useTranslation } from "react-i18next"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * Die Rueckfrage nach einem <strong>409</strong>
 * {@code PROJECT_VERSION_CONFLICT} (§6.4, KAN-35): jemand anders hat
 * dasselbe Projekt gespeichert, waehrend diese Fassung offen war.
 *
 * <p><strong>Genau zwei Wege, und "Ueberschreiben" ist keiner davon.</strong>
 * §6.4 sieht ihn nicht vor, und die 409-Antwort traegt weder den Serverstand
 * noch einen Weg, beide Fassungen zusammenzufuehren. Angeboten wird deshalb
 * das Neuladen, das den Serverstand uebernimmt und die eigenen Eingaben
 * verwirft, oder das Stehenlassen der eigenen Fassung, die dann aber nicht
 * mehr gespeichert wird. Beides ist ein Verlust, und die Person entscheidet,
 * welcher ihr lieber ist; still zu entscheiden waere der eine Fall, den die
 * Versionspruefung gerade verhindern soll.
 *
 * <p><strong>Kein automatischer zweiter Versuch.</strong> Ein Wiederholen
 * mit der neuen Version ueberschriebe genau die fremde Aenderung (Skill
 * frontend-api, Abschnitt 6). Die aufrufende Mutation laeuft deshalb ohne
 * {@code retry}.
 *
 * <p>Der Dialog liegt unter {@code common/}, weil der Editor denselben Fall
 * zeigt (KAN-36): er schreibt Bloecke gegen dieselbe {@code version}.
 *
 * <p><strong>{@code finalFocus} ist Pflicht, nicht Kosmetik.</strong> Der
 * Dialog hat keinen Trigger, sondern wird von einer fehlgeschlagenen
 * Mutation geoeffnet. Ohne Rueckgabeziel faellt der Fokus beim Schliessen
 * auf {@code body}, und die Tastaturbedienung beginnt wieder am Seitenanfang
 * (SC 2.4.3).
 */
export function VersionConflictDialog({
  open,
  onReload,
  onKeepEditing,
  finalFocus,
}: {
  open: boolean
  /** Serverstand uebernehmen: neu laden, eigene Eingaben verwerfen. */
  onReload: () => void
  /** Eigene Fassung stehen lassen und nicht mehr schreiben. */
  onKeepEditing: () => void
  /**
   * Element, das den Fokus beim Schliessen zurueckbekommt, in aller Regel
   * die Schaltflaeche "Speichern".
   */
  finalFocus?: React.RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        /* Escape und ein Klick daneben bedeuten dasselbe wie "eigene
           Fassung behalten": nichts wird geschrieben, nichts verworfen. */
        if (!next) {
          onKeepEditing()
        }
      }}
    >
      <AlertDialogContent finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("versionConflict.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("versionConflict.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Abbrechen zuerst, dann die Handlung mit ihrem eigenen Verb
              (Skill frontend-design, Abschnitt 5). Keine der beiden
              zerstoert fremde Arbeit, also traegt keine destructive. */}
          <AlertDialogCancel onClick={onKeepEditing}>
            {t("versionConflict.keepEditing")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onReload}>
            {t("versionConflict.reload")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
