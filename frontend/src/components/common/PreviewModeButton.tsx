import { EyeIcon, MessageSquareIcon, PencilIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

/**
 * Das Gegenstueck zur Vorschau: die Schreibflaeche des Editors oder die
 * Reviewansicht der Redaktion.
 */
export type PreviewCounterpart = "edit" | "review"

/** Wohin ein Druck fuehrt, und damit, was der Knopf gerade anbietet. */
type Target = "preview" | PreviewCounterpart

/*
 * Beschriftung und Symbol je Ziel, als Tabelle ueber den Zieltyp und ohne
 * Standardzweig: ein drittes Gegenstueck bricht den Typecheck, statt still
 * mit der Beschriftung eines anderen dazustehen.
 */
const TARGET_ICON = {
  preview: EyeIcon,
  edit: PencilIcon,
  review: MessageSquareIcon,
} as const satisfies Record<Target, unknown>

const TARGET_LABEL = {
  preview: "projectContent.sidebar.preview",
  edit: "projectContent.sidebar.edit",
  review: "review.detail.mode.review",
} as const satisfies Record<Target, string>

/**
 * Beschriftung und Symbol des Umschalters zwischen einer Arbeitsansicht und
 * ihrer Vorschau (KAN-104).
 *
 * <p><strong>Die Beschriftung nennt, wohin der Druck fuehrt</strong>, nicht,
 * wo man steht: in der Arbeitsansicht „Vorschau" mit Auge, in der Vorschau
 * das Gegenstueck, im Editor „Bearbeiten" mit Stift, in der Reviewansicht
 * „Review" mit Sprechblase (KAN-104, Entscheidung). Die Redaktion bearbeitet
 * dort nichts, ein Stift waere eine falsche Zusage.
 *
 * <p>Als eigener Baustein neben dem Knopf, weil der Editor dieselbe
 * Beschriftung schmal als Menueeintrag fuehrt. Zwei Abschriften derselben
 * Zuordnung liefen beim naechsten Gegenstueck auseinander.
 */
export function PreviewModeLabel({
  previewing,
  counterpart,
}: {
  /** Steht die Seite gerade in der Vorschau? */
  previewing: boolean
  counterpart: PreviewCounterpart
}) {
  const { t } = useTranslation()
  const target: Target = previewing ? counterpart : "preview"
  const Icon = TARGET_ICON[target]

  return (
    <>
      <Icon aria-hidden="true" />
      {t(TARGET_LABEL[target])}
    </>
  )
}

/**
 * Der Umschalter zwischen Arbeitsansicht und Vorschau (KAN-104), gemeinsam
 * fuer Editor und Reviewansicht.
 *
 * <p><strong>Ein Knopf mit wechselnder Beschriftung und kein Schalter</strong>
 * (KAN-104, Entscheidung). Er loest ab, was zuvor als Schiebeschalter auf der
 * oeffentlichen Detailseite und in der Reviewansicht stand und von dort auf
 * eine andere Route fuehrte. Die Vorschau entsteht jetzt an Ort und Stelle,
 * die Seite haelt den Zustand und entscheidet, was sie zeigt.
 *
 * <p><strong>Kein {@code aria-pressed}.</strong> Ein gedrueckter Zustand an
 * einem Knopf, dessen Name wechselt, sagte zweimal dasselbe und widerspraeche
 * sich dabei: „Bearbeiten, gedrueckt" hiesse, man bearbeite gerade, obwohl die
 * Vorschau steht. Der Name allein traegt die Handlung (SC 4.1.2); den Wechsel
 * sagt die Seite ueber ihre Live-Region an (SC 4.1.3).
 *
 * <p><strong>Derselbe Knoten in beiden Zustaenden.</strong> Nur Kinder und
 * Name wechseln, das Element bleibt stehen, und der Fokus bleibt nach dem
 * Druck, wo er war (SC 2.4.3). Die Seite darf ihn deshalb nicht in zwei
 * Zweigen rendern.
 *
 * <p>Ohne Tiptap: die Reviewansicht zieht diese Datei, und ihr Importbaum
 * bleibt frei von {@code @tiptap/*} und {@code prosemirror-*}
 * ({@code rendererImports.test.ts}).
 */
export function PreviewModeButton({
  previewing,
  counterpart,
  onToggle,
  variant = "outline",
  size = "default",
  className,
}: {
  previewing: boolean
  counterpart: PreviewCounterpart
  /** Wechselt den Modus; welcher gilt, haelt die Seite. */
  onToggle: () => void
  variant?: "outline" | "link" | "ghost"
  size?: "default" | "sm"
  className?: string
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={onToggle}
    >
      <PreviewModeLabel previewing={previewing} counterpart={counterpart} />
    </Button>
  )
}
