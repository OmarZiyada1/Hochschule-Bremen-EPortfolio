import {
  BracesIcon,
  CodeIcon,
  FileTextIcon,
  ImageIcon,
  ImagePlusIcon,
  MinusIcon,
  MusicIcon,
  SigmaIcon,
  TableIcon,
  VideoIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Die Einfuegeleiste am Plus der Blockbedienung (Figma
 * {@code Template / Studierende · Editor}).
 *
 * <p><strong>Eine Pille mit runden Symbolschaltflaechen</strong>, wie im
 * Template gezeichnet, und kein Auswahlmenue: die zehn Typen stehen
 * nebeneinander und sind mit einem Klick erreichbar. Ein Menue mit Suchfeld
 * verlangt fuer denselben Vorgang zwei Klicks oder eine Eingabe, und die
 * Symbole sind dieselben, die danach im Beitrag stehen.
 *
 * <p><strong>Jeder Typ entsteht unmittelbar</strong>, auch Bild, Galerie,
 * Video, Ton, Dokument, Einbettung und Formel. Sie kommen als leerer
 * Platzhalter in den Text und werden dort gefuellt; gespeichert werden sie
 * erst, wenn sie ihre Pflichtattribute haben
 * ({@code blockSerialization.docToBlocks}). Ohne diese Regel waere ein
 * leerer Medienknoten ein Sackgassenzustand, in dem sich der ganze Beitrag
 * nicht mehr speichern liesse.
 *
 * <p><strong>Keine Aufgabenliste.</strong> Der alte Prototyp zeichnet an
 * dieser Stelle ein Kaestchen-Symbol; {@code taskList} ist kein Teil des
 * Schemas (Contract 2.5, „Keine Aufgabenlisten"). Das Portal ist ein
 * Praesentationsportfolio.
 *
 * <p>Der Fokus springt beim Oeffnen auf die erste Schaltflaeche, Escape
 * schliesst und gibt ihn an das Plus zurueck.
 */

export type InsertKind =
  | "image"
  | "gallery"
  | "video"
  | "audio"
  | "document"
  | "embed"
  | "formula"
  | "table"
  | "code"
  | "divider"

const ENTRIES: readonly { kind: InsertKind; icon: LucideIcon }[] = [
  { kind: "image", icon: ImageIcon },
  { kind: "gallery", icon: ImagePlusIcon },
  { kind: "video", icon: VideoIcon },
  { kind: "audio", icon: MusicIcon },
  { kind: "document", icon: FileTextIcon },
  { kind: "embed", icon: BracesIcon },
  { kind: "formula", icon: SigmaIcon },
  { kind: "table", icon: TableIcon },
  { kind: "code", icon: CodeIcon },
  { kind: "divider", icon: MinusIcon },
]

export function BlockInsertBar({
  onSelect,
  onClose,
}: {
  onSelect: (kind: InsertKind) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  return (
    <div
      contentEditable={false}
      role="group"
      aria-label={t("projectContent.insert.label")}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose()
        }
      }}
      className="flex items-center gap-1.5 rounded-pill border border-border bg-popover px-2 py-1.5 shadow-md"
    >
      <button
        type="button"
        ref={firstRef}
        onClick={onClose}
        className="flex size-8 items-center justify-center rounded-pill border-2 border-border text-muted-foreground outline-none hover:border-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <XIcon aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{t("projectContent.insert.close")}</span>
      </button>

      {ENTRIES.map(({ kind, icon: Icon }) => {
        const label = t(`projectContent.insert.type.${kind}`)
        return (
          <Tooltip key={kind}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onSelect(kind)}
                  className="flex size-8 items-center justify-center rounded-pill border-2 border-primary text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              }
            >
              <Icon aria-hidden="true" className="size-3.5" />
              <span className="sr-only">{label}</span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
