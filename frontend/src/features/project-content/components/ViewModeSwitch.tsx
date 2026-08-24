import { EyeIcon, MessageSquareIcon, PencilIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * Der Umschalter zwischen Vorschau und Bearbeiten (Figma, Knoten
 * {@code Right}, oberste Karte).
 *
 * <p><strong>Er steht auf der oeffentlichen Detailseite</strong> und fuehrt
 * von dort zurueck in den Editor. Eine Vorschau, aus der es keinen Weg
 * zurueck gibt, waere eine Sackgasse.
 *
 * <p><strong>Im Editor steht er nicht mehr</strong> (Nutzerentscheidung):
 * dort gibt es nur eine Richtung, naemlich in die Vorschau, und dafuer ist
 * ein Weg richtig und kein Schalter mit zwei Zustaenden. Die Kopfzeile des
 * Editors fuehrt ihn deshalb als Schaltflaeche „Vorschau".
 *
 * <p><strong>Vorschau heisst die echte Seite und keine Nachbildung.</strong>
 * Ob ein Beitrag nachher richtig aussieht, beantwortet nur die Seite
 * selbst, mit ihrer Breite, ihrer Umgebung und demselben Renderer.
 *
 * <p><strong>Die rechte Seite ist nicht immer „Bearbeiten".</strong> Der
 * Review-Modus aus KAN-37 zeigt denselben Umschalter mit „Review" statt
 * „Bearbeiten" (Template „Editor (Review-Modus)"): dieselbe Domaene,
 * dieselbe Bedienung, ein anderes Gegenstueck zur Vorschau. Deshalb
 * {@code alternate} an dieser Huelle und keine zweite Komponente daneben;
 * eine Abschrift liefe beim naechsten Barrierefreiheits-Nachzug auseinander.
 *
 * <p><strong>Die beiden Woerter links und rechts sind Zierat.</strong> Sie
 * werden nicht vorgelesen ({@code aria-hidden}) und sagen nicht, welcher
 * Zustand gilt; der zugaengliche Name des Schalters nennt genau eine Sache,
 * und {@code aria-checked} sagt ein oder aus. Ohne das hoerte man nur
 * „Schalter, aktiviert" und wuesste nicht, wovon.
 */
export type ViewMode = "preview" | "edit" | "review"

export function ViewModeSwitch({
  mode,
  onModeChange,
  alternate = "edit",
  className,
}: {
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  /** Das Gegenstueck zur Vorschau: der Editor oder der Review-Modus. */
  alternate?: "edit" | "review"
  className?: string
}) {
  const { t } = useTranslation()
  const editing = mode !== "preview"
  const AlternateIcon = alternate === "review" ? MessageSquareIcon : PencilIcon
  const alternateLabel =
    alternate === "review"
      ? t("review.detail.mode.review")
      : t("projectContent.sidebar.edit")
  const toggleLabel =
    alternate === "review"
      ? t("review.detail.mode.toggle")
      : t("projectContent.sidebar.previewToggle")

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
        aria-label={toggleLabel}
        onCheckedChange={(checked) =>
          onModeChange(checked ? alternate : "preview")
        }
      />
      <span
        aria-hidden="true"
        className={cn(
          "type-body-sm flex items-center gap-1.5",
          editing ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        <AlternateIcon className="size-3.5" />
        {alternateLabel}
      </span>
    </div>
  )
}
