import { useTranslation } from "react-i18next"

import { FieldDescription } from "@/components/ui/field"
import { cn } from "@/lib/utils"

/**
 * Restzeichenanzeige fuer begrenzte Felder: Titel 100, Kurzbeschreibung 200
 * (Template "Projekt-Metadaten"). Ohne Live-Region ist die Restanzahl fuer
 * Screenreader unsichtbar, und das Feld laeuft ohne Vorwarnung voll
 * (SC 4.1.3). Verbindlich bleibt der Server; die Anzeige warnt nur vor dem
 * Absenden.
 *
 * Sichtbar steht immer die genaue Zahl, angesagt wird nur an Schwellen. Eine
 * Live-Region, die bei jedem Tastendruck neu schreibt, erzeugt eine Ansage je
 * Zeichen: wer eine Kurzbeschreibung tippt, bekommt zweihundert Ansagen, die
 * sich mit dem Echo der eigenen Eingabe ueberlagern, und versteht am Ende
 * beides nicht. SC 4.1.3 verlangt, dass die Anzeige wahrnehmbar ist, nicht
 * dass sie ununterbrochen spricht. Gesprochen wird deshalb erst im letzten
 * Zehntel und dort in Schritten von fuenf Zeichen, dazu jede Ueberschreitung:
 * die ist ein Fehlerzustand und muss sofort ankommen.
 */
export function CharacterCounter({
  value,
  max,
  id,
  className,
}: {
  value: string
  max: number
  id?: string
  className?: string
}) {
  const { t } = useTranslation()
  const remaining = max - value.length
  const over = remaining < 0
  const label = over
    ? t("common.characterCounter.tooMany", { count: -remaining })
    : t("common.characterCounter.remaining", { count: remaining })

  const threshold = Math.max(5, Math.ceil(max / 10))
  const announced = over || (remaining <= threshold && remaining % 5 === 0)

  return (
    <>
      <FieldDescription
        id={id}
        className={cn("tabular-nums", over && "text-destructive", className)}
      >
        {label}
      </FieldDescription>
      {/* Getrennt vom sichtbaren Text, damit die Ansage an Schwellen haengt
          und nicht an jeder Neuberechnung der Anzeige. */}
      <span className="sr-only" role="status">
        {announced ? label : ""}
      </span>
    </>
  )
}
