import { EyeIcon, PencilIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * Der Umschalter zwischen Vorschau und Bearbeiten (Figma, Knoten
 * {@code Right}, oberste Karte).
 *
 * <p><strong>Er steht auf beiden Seiten des Wechsels.</strong> Im Editor
 * fuehrt er auf die oeffentliche Detailseite, dort fuehrt er zurueck in den
 * Editor. Eine Vorschau, aus der es keinen Weg zurueck gibt, waere eine
 * Sackgasse; zwei verschieden aussehende Schalter dafuer waeren zwei
 * Bedienungen fuer dieselbe Sache. Deshalb eine Komponente fuer beide
 * Richtungen.
 *
 * <p><strong>Vorschau heisst die echte Seite und keine Nachbildung.</strong>
 * Ob ein Beitrag nachher richtig aussieht, beantwortet nur die Seite
 * selbst, mit ihrer Breite, ihrer Umgebung und demselben Renderer.
 *
 * <p><strong>Die beiden Woerter links und rechts sind Zierat.</strong> Sie
 * werden nicht vorgelesen ({@code aria-hidden}) und sagen nicht, welcher
 * Zustand gilt; der zugaengliche Name des Schalters nennt genau eine Sache,
 * und {@code aria-checked} sagt ein oder aus. Ohne das hoerte man nur
 * „Schalter, aktiviert" und wuesste nicht, wovon.
 */
export function ViewModeSwitch({
  mode,
  onModeChange,
  className,
}: {
  mode: "preview" | "edit"
  onModeChange: (mode: "preview" | "edit") => void
  className?: string
}) {
  const { t } = useTranslation()
  const editing = mode === "edit"

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-card border border-border bg-card px-4 py-3",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "type-body-sm flex items-center gap-1.5",
          editing ? "text-muted-foreground" : "font-semibold text-foreground"
        )}
      >
        <EyeIcon className="size-3.5" />
        {t("projectContent.sidebar.preview")}
      </span>
      <Switch
        checked={editing}
        aria-label={t("projectContent.sidebar.previewToggle")}
        onCheckedChange={(checked) =>
          onModeChange(checked ? "edit" : "preview")
        }
      />
      <span
        aria-hidden="true"
        className={cn(
          "type-body-sm flex items-center gap-1.5",
          editing ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        <PencilIcon className="size-3.5" />
        {t("projectContent.sidebar.edit")}
      </span>
    </div>
  )
}
