import { useTranslation } from "react-i18next"

import { FieldDescription } from "@/components/ui/field"
import { cn } from "@/lib/utils"

/**
 * Restzeichenanzeige fuer begrenzte Felder: Titel 100, Kurzbeschreibung 200
 * (Template "Projekt-Metadaten"). role="status" macht die Anzeige zur
 * Live-Region: ohne sie ist die Restanzahl fuer Screenreader unsichtbar,
 * und das Feld laeuft ohne Vorwarnung voll (SC 4.1.3). Verbindlich bleibt
 * der Server; die Anzeige warnt nur vor dem Absenden.
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
  return (
    <FieldDescription
      id={id}
      role="status"
      className={cn("tabular-nums", over && "text-destructive", className)}
    >
      {over
        ? t("common.characterCounter.tooMany", { count: -remaining })
        : t("common.characterCounter.remaining", { count: remaining })}
    </FieldDescription>
  )
}
