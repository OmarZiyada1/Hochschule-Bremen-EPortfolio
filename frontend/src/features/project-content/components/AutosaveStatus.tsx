import { AlertCircleIcon, CheckIcon, LoaderIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { AutosaveState } from "@/features/project-content/hooks/useAutosave"

/**
 * Der sichtbare Speicherzustand des Editors.
 *
 * <p><strong>Ein stiller Fehlschlag ist Datenverlust mit Ansage.</strong>
 * Wer schreibt, verlaesst sich darauf, dass der Takt laeuft; bleibt er ohne
 * Zeichen stehen, faellt es erst auf, wenn die Seite geschlossen ist.
 * Deshalb traegt jeder Zustand eine Entsprechung, und deshalb steht das
 * Element in einer Live-Region.
 *
 * <p><strong>{@code role="status"} und nicht {@code role="alert"}.</strong>
 * Der Speicherzustand ist eine Randmeldung: {@code status} unterbricht die
 * Vorlesestelle nicht, sondern reiht sich ein. Ein {@code alert}
 * unterbraeche bei jedem Takt den Satz, an dem gerade geschrieben wird.
 *
 * <p>Das Element steht immer im DOM, auch im Zustand {@code idle} mit
 * leerem Text: eine erst beim Ereignis eingehaengte Live-Region wird von
 * manchen Screenreadern nicht mehr vorgelesen.
 */
export function AutosaveStatus({ state }: { state: AutosaveState }) {
  const { t } = useTranslation()

  const label =
    state === "idle" ? "" : t(`projectContent.autosave.${state}`)

  return (
    <p
      role="status"
      data-state={state}
      className="type-body-sm flex items-center gap-1.5 text-muted-foreground data-[state=conflict]:text-destructive data-[state=error]:text-destructive"
    >
      {/* Die Symbole sind Zierat und werden nicht vorgelesen: der Zustand
          steht als Text daneben, sonst waere er nur ueber die Farbe zu
          erkennen (SC 1.4.1). */}
      {state === "saving" && (
        <LoaderIcon aria-hidden="true" className="size-3.5 animate-spin" />
      )}
      {state === "saved" && <CheckIcon aria-hidden="true" className="size-3.5" />}
      {(state === "error" || state === "conflict") && (
        <AlertCircleIcon aria-hidden="true" className="size-3.5" />
      )}
      {label}
    </p>
  )
}
