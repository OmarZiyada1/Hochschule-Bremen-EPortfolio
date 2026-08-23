import { CheckIcon, LoaderIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { AutosaveState } from "@/features/project-content/hooks/useAutosave"

/**
 * Der Speicherzustand neben der Workflow-Aktion (Figma, Knoten
 * {@code Topbar}).
 *
 * <p><strong>Er steht in einer Live-Region</strong> ({@code role="status"}):
 * ein stiller Fehlschlag ist Datenverlust mit Ansage, denn wer
 * weiterschreibt, glaubt, es sei gespeichert. Die Region ist immer im DOM
 * und wechselt nur ihren Inhalt; erschiene sie erst mit der Meldung, laese
 * ein Screenreader sie unter Umstaenden gar nicht vor.
 *
 * <p><strong>Nicht nur Farbe</strong> (SC 1.4.1): jeder Zustand traegt
 * Symbol und Text.
 *
 * <p>Der Zustand {@code pending}, also „es liegt etwas an, der Takt laeuft
 * noch nicht", bleibt bewusst stumm. Ihn anzusagen hiesse, bei jedem
 * zweiten Wort etwas vorzulesen.
 */
export function AutosaveStatus({ state }: { state: AutosaveState }) {
  const { t } = useTranslation()

  return (
    <p
      role="status"
      className="type-caption flex min-w-28 items-center gap-1.5 text-muted-foreground"
    >
      {state === "saving" && (
        <>
          <LoaderIcon aria-hidden="true" className="size-3.5 animate-spin" />
          {t("projectContent.autosave.saving")}
        </>
      )}
      {state === "saved" && (
        <>
          <CheckIcon aria-hidden="true" className="size-3.5" />
          {t("projectContent.autosave.saved")}
        </>
      )}
      {(state === "error" || state === "conflict") && (
        <span className="flex items-center gap-1.5 text-destructive">
          <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
          {state === "conflict"
            ? t("projectContent.autosave.conflict")
            : t("projectContent.autosave.error")}
        </span>
      )}
    </p>
  )
}
