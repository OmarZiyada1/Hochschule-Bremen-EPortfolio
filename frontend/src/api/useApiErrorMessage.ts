import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"

/**
 * Der anzuzeigende Text zu einem Fehler, an genau einer Stelle abgeleitet
 * (KAN-42, Umfang 6). Vorher stand diese Ableitung 89 Mal im Code: teils als
 * lokale Funktion {@code messageOf} in sechs Seiten der Administrationsseite,
 * teils als dreizeiliger Bedingungsausdruck mitten in JSX, teils als blanker
 * Aufruf in einem {@code onError}. Alle Fassungen waren gleich, was genau das
 * Problem ist: eine Aenderung an der Rueckfallebene haette 89 Fundstellen
 * gehabt. Seither verweist {@code apiErrorMessageKey} ausserhalb von
 * {@code src/api/} an keiner Stelle mehr; 49 Aufrufe in 34 Dateien laufen
 * ueber diesen Hook, die uebrigen 40 ueber {@link ErrorState}.
 *
 * <p>Die Bindung heisst an den Aufrufstellen {@code apiMessage} und nicht
 * {@code messageOf}: elf Formulare fuehren bereits ein {@code messageOf} fuer
 * Feldfehler aus react-hook-form, und das ist etwas anderes.
 *
 * Die Reihenfolge der Quellen folgt Frontend-Regel 3 und Contract 6.2:
 *
 * 1. der i18n-Schluessel zum {@code errorCode} ({@code apiError.<CODE>}),
 * 2. ersatzweise der {@code message} des Servers, falls die i18n-Dateien
 *    diesen Code noch nicht kennen (er existiert nur deutsch, ist also
 *    Rueckfallebene und nie die Hauptquelle),
 * 3. bei allem, was kein {@link isApiError} ist, der generische Text zu
 *    {@code INTERNAL_ERROR}.
 *
 * Fall 3 tritt selten auf, weil {@code client.ts} jeden Transportfehler
 * bereits in einen ApiError uebersetzt; er faengt ab, was React Query aus
 * einem geworfenen Nicht-Fehler durchreicht. Entschieden wird auch hier nie
 * ueber den Meldungstext, sondern ueber den Code.
 *
 * Rueckgabe ist eine Funktion und kein Text, weil die aufrufende Stelle
 * meist mehrere Fehler nebeneinander fuehrt (Abfrage und Mutation) und
 * Hooks nicht in Bedingungen stehen duerfen.
 */
export function useApiErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation()

  return useCallback(
    (error: unknown) =>
      isApiError(error)
        ? t(apiErrorMessageKey(error), { defaultValue: error.message })
        : t("apiError.INTERNAL_ERROR"),
    [t]
  )
}
